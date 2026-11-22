// ==========================
// 首页搜索系统
// 说明：搜索数据来自 data/knowledge-base.json，之后只需要维护 JSON 即可。
//
// 支持三种输入：
//   1. 中文       ——「请假」
//   2. 拼音全拼   ——「qingjia」
//   3. 拼音首字母 ——「qj」
// 第 2、3 种由 data/pinyin-table.json（汉字 → 首字母）在前端转换，
// 不需要额外引拼音库。
// ==========================

let searchData = [];
let currentMatches = [];
let selectedIndex = -1;

// 汉字 → 首字母对照表（构建期生成）
let pinyinTable = {};

// ==========================================================
// 站点根路径与 URL 前缀
// ----------------------------------------------------------
// 这个脚本首页和子页面共用，但两者的相对路径不一样：
//   首页  →  数据在 data/…              跳转目标是 pages/xxx.html
//   子页  →  数据在 ../data/…           跳转目标是 ../pages/xxx.html
//
// 这里从 <body> 上的 data-root 属性读出站点根前缀，
// 由构建脚本按页面层级写入：
//   首页   <body data-root="">
//   子页   <body data-root="..">
//
// 没有这个属性时（老页面 / 直接打开本地文件），
// 自动用当前脚本自身的 URL 反推，效果一样。
//
// 注意：前缀统一以 / 结尾（"../"），拼接时不用再补斜杠。
// ==========================================================
const SITE_ROOT = (() => {
    const attr = document.body ? document.body.getAttribute("data-root") : null;
    let root;

    if (attr !== null && attr !== undefined) {
        root = attr;
    } else {
        // 兜底：从 script 标签的 src 反推
        // 形如 ../assets/js/search.js → 站点根是 ..
        root = "";
        const scripts = document.getElementsByTagName("script");
        for (const s of scripts) {
            const src = s.getAttribute("src") || "";
            const m = src.match(/^(.*?)assets\/js\/search\.js/);
            if (m) { root = m[1]; break; }
        }
    }

    // 归一化：空串保持空串（首页），其它补上结尾斜杠
    if (!root) return "";
    return root.endsWith("/") ? root : root + "/";
})();

// 把站点根相对路径转成当前页面可用的 URL
function siteUrl(path) {
    if (!path) return SITE_ROOT || "./";
    if (/^(https?:)?\/\//.test(path) || path.startsWith("#")) return path;
    return SITE_ROOT + path;
}

const searchInput = document.getElementById("global-search");
const searchInputDesktop = document.getElementById("global-search-desktop");
const suggestionBox = document.getElementById("search-suggestions");
const suggestionBoxDesktop = document.getElementById("search-suggestions-desktop");

// 读取搜索知识库。GitHub Pages 支持读取同项目里的 JSON 文件。
async function loadSearchData() {
    try {
        const response = await fetch(siteUrl("data/knowledge-base.json") + "?v=" + (window.SITE_VER || "1"));

        if (!response.ok) {
            throw new Error("搜索数据文件读取失败");
        }

        searchData = await response.json();
    } catch (error) {
        console.error("搜索数据加载失败", error);
    }

    // 拼音对照表是可选的，取不到也不影响中文搜索
    try {
        const res = await fetch(siteUrl("data/pinyin-table.json") + "?v=" + (window.SITE_VER || "1"));
        if (res.ok) pinyinTable = await res.json();
    } catch (error) {
        /* 忽略：拼音搜索不可用 */
    }
}

// 把输入里的每个汉字替换成它的拼音首字母。
// 例：「请假」-> 「qj」；「请」查不到就原样保留。
function toInitials(text) {
    let out = "";
    for (const ch of text) {
        const ini = pinyinTable[ch];
        out += ini || ch;
    }
    return out.toLowerCase();
}

// 把标题、分类、关键词合并成一段文字，便于做模糊匹配。
function getSearchText(item) {
    const keywords = Array.isArray(item.keywords)
        ? item.keywords.join(" ")
        : "";

    return `${item.title} ${item.category} ${keywords}`.toLowerCase();
}

// 根据输入内容筛选结果，最多显示 6 条，避免结果框过长。
function findMatches(keyword) {
    const value = keyword.trim().toLowerCase();

    if (!value) return [];

    return searchData
        .filter(item => {
            if (getSearchText(item).includes(value)) return true;

            // 输入是纯拉丁字母时，当作拼音来匹配。
            // 两种：
            //   首字母：qj → 请假
            //   全拼  ：qingjia → 请假
            //
            // 注意不能只判断「转换后的首字母 != 原输入」——
            // 用户直接输入 "qj" 时转换结果仍是 "qj"，
            // 那样就永远进不到这个分支了。
            if (/^[a-z]+$/.test(value)) {
                // 首字母匹配
                if (item.initials) {
                    const flatInitials = item.initials.replace(/\s+/g, "");
                    if (flatInitials.includes(value)) return true;
                }
                // 全拼匹配
                if (item.pinyin) {
                    const flatPinyin = item.pinyin.replace(/\s+/g, "");
                    if (flatPinyin.includes(value)) return true;
                }
                return false;
            }

            // 输入里含汉字时，把它转成首字母再匹配。
            // 例：输入「请假」时也能命中拼音首字母是 qj 的其它条目。
            const initials = toInitials(value);
            if (initials !== value && item.initials) {
                const flatInitials = item.initials.replace(/\s+/g, "");
                if (flatInitials.includes(initials)) return true;
            }

            return false;
        })
        .slice(0, 6);
}

// 渲染搜索下拉框。
function renderSuggestions(suggestionBoxEl, matches, keyword) {
    suggestionBoxEl.innerHTML = "";
    selectedIndex = -1;

    if (!keyword) {
        suggestionBoxEl.style.display = "none";
        return;
    }

    suggestionBoxEl.style.display = "block";

    if (matches.length === 0) {
        suggestionBoxEl.innerHTML = `
            <div class="suggestion-empty">
                暂时没有找到相关内容，可以换个关键词试试
            </div>
        `;
        return;
    }

    matches.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.dataset.index = index;

        div.innerHTML = `
            <span class="suggestion-title">${item.title}</span>
            <span class="suggestion-category">${item.category || "事务服务"}</span>
        `;

        div.addEventListener("click", () => {
            window.location.href = siteUrl(item.url);
        });

        suggestionBoxEl.appendChild(div);
    });
}

// 高亮移动
function moveHighlight(suggestionBoxEl, delta) {
    const items = suggestionBoxEl.querySelectorAll(".suggestion-item");
    if (items.length === 0) return;

    selectedIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + delta));
    updateHighlight(suggestionBoxEl);

    const selectedItem = items[selectedIndex];
    if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
    }
}

// 更新高亮状态
function updateHighlight(suggestionBoxEl) {
    const items = suggestionBoxEl.querySelectorAll(".suggestion-item");
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add("suggestion-item-active");
        } else {
            item.classList.remove("suggestion-item-active");
        }
    });
}

// 跳转到当前高亮项
function goToSelected(suggestionBoxEl) {
    const items = suggestionBoxEl.querySelectorAll(".suggestion-item");
    if (selectedIndex >= 0 && selectedIndex < items.length) {
        items[selectedIndex].click();
    } else if (currentMatches.length > 0) {
        window.location.href = siteUrl(currentMatches[0].url);
    }
}

// 初始化搜索框事件
function initSearchInput(searchInputEl, suggestionBoxEl) {
    if (!searchInputEl || !suggestionBoxEl) return;

    searchInputEl.addEventListener("input", function () {
        const keyword = this.value;

        currentMatches = findMatches(keyword);
        renderSuggestions(suggestionBoxEl, currentMatches, keyword.trim());
    });

    // 键盘导航：上下键选择，回车跳转
    searchInputEl.addEventListener("keydown", function (event) {
        if (suggestionBoxEl.style.display === "block") {
            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    moveHighlight(suggestionBoxEl, 1);
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    moveHighlight(suggestionBoxEl, -1);
                    break;
                case "Enter":
                    event.preventDefault();
                    goToSelected(suggestionBoxEl);
                    break;
                case "Escape":
                    suggestionBoxEl.style.display = "none";
                    selectedIndex = -1;
                    break;
            }
        } else if (event.key === "Enter") {
            // 没有显示建议时，尝试搜索（已有数据则跳转第一个）
            if (currentMatches.length > 0) {
                window.location.href = siteUrl(currentMatches[0].url);
            }
        }
    });

    // 点击页面空白处时，关闭搜索建议框。
    document.addEventListener("click", function (event) {
        const clickedInsideSearch =
            searchInputEl.contains(event.target) ||
            suggestionBoxEl.contains(event.target);

        if (!clickedInsideSearch) {
            suggestionBoxEl.style.display = "none";
            selectedIndex = -1;
        }
    });
}

// 初始化两个搜索框
if (searchInput || searchInputDesktop) {
    loadSearchData();
    initSearchInput(searchInput, suggestionBox);
    initSearchInput(searchInputDesktop, suggestionBoxDesktop);
}

// 手机端：确保搜索建议框显示
function ensureMobileSuggestions() {
    if (!searchInput || !suggestionBox) return;
    if (window.innerWidth > 768) return;
    // suggestions 现在用 absolute 定位，相对 wrapper 自动贴合，无需手动设置位置
}
