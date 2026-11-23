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

// ==========================================================
// Worker API 地址
//
// 为什么从配置读而不是写死在代码里：
//   国内访问 workers.dev 域名可能不稳定（DNS 污染）。
//   如果 Worker 绑了自定义域名，只要改
//   data/site-config.json 里的 apiBase 就行，
//   不用去各个 js 文件里翻着改。
//
// 读取失败就用默认值兜底 —— 读不到配置不该让整个搜索崩掉。
// ==========================================================
const DEFAULT_API_BASE = "https://qiqida-stats-worker.dddhui-qi.workers.dev/api";
let apiBase = DEFAULT_API_BASE;

async function loadApiBase() {
    try {
        const res = await fetch(siteUrl("data/site-config.json") + "?v=" + (window.SITE_VER || "1"));
        if (res.ok) {
            const cfg = await res.json();
            if (cfg && cfg.apiBase) {
                apiBase = cfg.apiBase.replace(/\/+$/, "");
            }
        }
    } catch (error) {
        /* 忽略：用默认值 */
    }
}

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

    // API 地址（搜索词上报用）
    await loadApiBase();
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

// 判断一个词的首字母是否命中关键词。
//
// 为什么不能把 initials 拍平再 includes：
//   initials 是「每个词的首字母」用空格拼起来的，例如
//   「毕业设计」→ "bysj bs kt zqjc cz lw"（毕设 毕设 开题 中期检查 查重 论文）
//   拍平成 "bysjbsktzqjcczlw" 之后，里面就出现了 "qj"（中期检查的 z**qj**c），
//   搜「请假」会把「毕业设计」也命中，纯属误报。
//
// 为什么用 startsWith 而不是 includes：
//   「入学教育与体检」的 keywords 里有「安全教育考试」，首字母是 "aqjyks"，
//   里面含 "qj"，includes 会误命中。
//   但学生搜 "qj" 想找的永远是「以 qj 开头」的那个词（请假），
//   所以只认开头，不认中间。
//
// 首字母串本身就是「每个汉字取一个字母」，所以：
//   搜 qj      → 匹配 "qj"（请假）
//   搜 qjtsq   → 匹配 "qjtsq"（请假条申请表）
//   搜 xk      → 匹配 "xk"（休学）
function matchesPinyin(item, value) {
    if (!item.initials) return false;

    const tokens = item.initials.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
        if (token.startsWith(value)) return true;
    }
    return false;
}

// 判断一个词的全拼是否命中关键词。
//
// 全拼串比较长（"qingjia" 七个字母），中间包含的误命中概率低得多，
// 所以这里保留 includes —— 搜 "qingjia" 能命中 "qingjiaband"（请假报销单），
// 用 startsWith 就搜不到了。
function matchesFullPinyin(item, value) {
    if (!item.pinyin) return false;

    const tokens = item.pinyin.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
        if (token.includes(value)) return true;
    }
    return false;
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
                if (matchesPinyin(item, value)) return true;
                // 全拼匹配
                if (matchesFullPinyin(item, value)) return true;
                return false;
            }

            // 输入里含汉字时，把它转成首字母再匹配。
            // 例：输入「请假」时也能命中拼音首字母是 qj 的其它条目。
            const initials = toInitials(value);
            if (initials !== value && matchesPinyin(item, initials)) {
                return true;
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
        // 没结果时也给一个「去搜索页看看」的出口，
        // 那里会列出专区入口和留言入口，学生不至于走到死路。
        appendAllResultsLink(suggestionBoxEl, keyword);
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

    // 下拉最多 6 条，但可能还有更多命中。
    // 给一个「查看全部结果」的入口跳到搜索结果页。
    appendAllResultsLink(suggestionBoxEl, keyword);
}

// 在下拉框底部加「查看全部结果」入口。
//
// 为什么需要：
//   下拉只显示 6 条，搜「请」这种宽泛的词会命中很多页面。
//   没有这个入口，学生就看不到剩下的，只能一个个点着试。
function appendAllResultsLink(suggestionBoxEl, keyword) {
    const link = document.createElement("div");
    link.className = "suggestion-all";
    link.setAttribute("role", "button");
    link.setAttribute("tabindex", "0");

    const encoded = encodeURIComponent(keyword.trim());
    link.innerHTML = `
        <span class="suggestion-all-text">查看全部搜索结果</span>
        <span class="suggestion-all-arrow" aria-hidden="true">→</span>
    `;

    const go = function () {
        window.location.href = siteUrl("pages/search.html?q=" + encoded);
    };

    link.addEventListener("click", go);
    link.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
        }
    });

    suggestionBoxEl.appendChild(link);
}

// 跳到搜索结果页。
function goToSearchPage(keyword) {
    const value = (keyword || "").trim();
    if (!value) return;
    reportSearch(value);
    window.location.href = siteUrl("pages/search.html?q=" + encodeURIComponent(value));
}

// ==========================================================
// 搜索词上报
//
// 为什么上报：
//   「常见搜索词」那一组词现在是人工挑的。
//   如果知道学生实际在搜什么，就能：
//     · 发现「想搜但搜不到」的功能缺口
//     · 发现学生用的说法（叫「校园卡」而不是「一卡通」）
//     · 把搜索词自动补进各页面的 keywords
//
// 上报去哪：
//   打到 Cloudflare Worker 的 /api/search 接口。
//   地址从 data/site-config.json 的 apiBase 读（见上面的 loadApiBase）。
//   Worker 那边暂时只记录不展示，先把数据攒起来。
//
// 注意：
//   · 只上报关键词本身，不带任何个人信息
//   · 同一个词 30 分钟内不重复上报（sessionStorage 去重）
//   · 上报失败完全不影响搜索功能
// ==========================================================
const SEARCH_REPORT_DEDUP_MS = 30 * 60 * 1000;   // 30 分钟

function reportSearch(keyword) {
    const value = (keyword || "").trim();
    if (!value || value.length > 30) return;

    // 太短的词（单字）没有分析价值
    if (value.length < 2) return;

    try {
        // 去重：同一个词 30 分钟内只报一次
        const storeKey = "srch:" + value;
        const last = parseInt(sessionStorage.getItem(storeKey) || "0", 10);
        if (Date.now() - last < SEARCH_REPORT_DEDUP_MS) return;
        sessionStorage.setItem(storeKey, String(Date.now()));
    } catch (e) {
        // sessionStorage 不可用（隐私模式）时不影响搜索
    }

    try {
        fetch(apiBase + "/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keyword: value }),
        }).catch(function () {
            // 上报失败就失败，不打扰用户
        });
    } catch (e) {
        // 同上
    }
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
                    // 有高亮项就跳那一项；
                    // 没有高亮项就跳搜索结果页（而不是默认跳第一条），
                    // 这样学生按回车看到的是「全部结果」，可以再挑。
                    if (selectedIndex >= 0) {
                        goToSelected(suggestionBoxEl);
                    } else {
                        goToSearchPage(searchInputEl.value);
                    }
                    break;
                case "Escape":
                    suggestionBoxEl.style.display = "none";
                    selectedIndex = -1;
                    break;
            }
        } else if (event.key === "Enter") {
            // 下拉没显示时（还没加载完、或被关掉了），
            // 直接去搜索结果页。
            if (searchInputEl.value.trim()) {
                event.preventDefault();
                goToSearchPage(searchInputEl.value);
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
