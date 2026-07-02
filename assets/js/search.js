// ==========================
// 首页搜索系统
// 说明：搜索数据来自 data/knowledge-base.json，之后只需要维护 JSON 即可。
// ==========================

let searchData = [];
let currentMatches = [];
let selectedIndex = -1;

const searchInput = document.getElementById("global-search");
const suggestionBox = document.getElementById("search-suggestions");

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
function renderSuggestions(matches, keyword) {
    suggestionBox.innerHTML = "";
    selectedIndex = -1;

    if (!keyword) {
        suggestionBox.style.display = "none";
        return;
    }

    suggestionBox.style.display = "block";

    if (matches.length === 0) {
        suggestionBox.innerHTML = `
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
            <strong>${item.title}</strong>
            <small>${item.category || "事务服务"}</small>
        `;

        div.addEventListener("click", () => {
            window.location.href = item.url;
        });

        suggestionBox.appendChild(div);
    });
}

// 高亮移动
function moveHighlight(delta) {
    const items = suggestionBox.querySelectorAll(".suggestion-item");
    if (items.length === 0) return;

    selectedIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + delta));
    updateHighlight();

    const selectedItem = items[selectedIndex];
    if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
    }
}

// 更新高亮状态
function updateHighlight() {
    const items = suggestionBox.querySelectorAll(".suggestion-item");
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add("suggestion-item-active");
            item.style.outline = "2px solid var(--primary-color, #007AFF)";
            item.style.backgroundColor = "var(--primary-light, rgba(0,122,255,0.1))";
            item.style.borderRadius = "8px";
        } else {
            item.classList.remove("suggestion-item-active");
            item.style.outline = "";
            item.style.backgroundColor = "";
            item.style.borderRadius = "";
        }
    });
}

// 跳转到当前高亮项
function goToSelected() {
    const items = suggestionBox.querySelectorAll(".suggestion-item");
    if (selectedIndex >= 0 && selectedIndex < items.length) {
        items[selectedIndex].click();
    } else if (currentMatches.length > 0) {
        window.location.href = currentMatches[0].url;
    }
}

if (searchInput && suggestionBox) {
    loadSearchData();

    searchInput.addEventListener("input", function () {
        const keyword = this.value;

        currentMatches = findMatches(keyword);
        renderSuggestions(currentMatches, keyword.trim());
    });

    // 键盘导航：上下键选择，回车跳转
    searchInput.addEventListener("keydown", function (event) {
        if (suggestionBox.style.display === "block") {
            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    moveHighlight(1);
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    moveHighlight(-1);
                    break;
                case "Enter":
                    event.preventDefault();
                    goToSelected();
                    break;
                case "Escape":
                    suggestionBox.style.display = "none";
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
            searchInput.contains(event.target) ||
            suggestionBox.contains(event.target);

        if (!clickedInsideSearch) {
            suggestionBox.style.display = "none";
            selectedIndex = -1;
        }
    });
}
