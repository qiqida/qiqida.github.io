// ==========================
// 首页搜索系统
// 说明：搜索数据来自 data/knowledge-base.json，之后只需要维护 JSON 即可。
// ==========================

let searchData = [];
let currentMatches = [];

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

    matches.forEach(item => {
        const div = document.createElement("div");
        div.className = "suggestion-item";

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

function goToFirstResult() {
    if (currentMatches.length > 0) {
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

    // 学生输入关键词后按 Enter，直接进入第一条结果。
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            goToFirstResult();
        }
    });

    // 点击页面空白处时，关闭搜索建议框。
    document.addEventListener("click", function (event) {
        const clickedInsideSearch =
            searchInput.contains(event.target) ||
            suggestionBox.contains(event.target);

        if (!clickedInsideSearch) {
            suggestionBox.style.display = "none";
        }
    });
}
