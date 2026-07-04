// ==========================
// 首页搜索系统
// 说明：搜索数据来自 data/knowledge-base.json，之后只需要维护 JSON 即可。
// ==========================

let searchData = [];
let currentMatches = [];
let selectedIndex = -1;

const searchInput = document.getElementById("global-search");
const searchInputDesktop = document.getElementById("global-search-desktop");
const suggestionBox = document.getElementById("search-suggestions");
const suggestionBoxDesktop = document.getElementById("search-suggestions-desktop");

// 读取搜索知识库。GitHub Pages 支持读取同项目里的 JSON 文件。
async function loadSearchData() {
    try {
        const response = await fetch("data/knowledge-base.json");

        if (!response.ok) {
            throw new Error("搜索数据文件读取失败");
        }

        searchData = await response.json();
    } catch (error) {
        console.error("搜索数据加载失败", error);
    }
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
        .filter(item => getSearchText(item).includes(value))
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
            window.location.href = item.url;
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
        window.location.href = currentMatches[0].url;
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
                window.location.href = currentMatches[0].url;
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
