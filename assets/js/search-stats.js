// ==========================
// 搜索关键词统计（V7.5 Apple 风格）
// 说明：读取 data/search-stats.json，渲染全宽居中词云。
// 支持毛玻璃效果与 hover 动效，点击后聚焦搜索框并滚动到搜索框。
// ==========================

async function loadSearchStats() {
    const container = document.getElementById("search-stats-container");
    if (!container) return;

    try {
        const response = await fetch("data/search-stats.json");
        const stats = await response.json();

        const maxCount = Math.max(...stats.map((item) => item.count));

        container.innerHTML = stats
            .map((item) => {
                const size = 13 + (item.count / maxCount) * 6;
                return `
                <span class="search-tag" style="font-size: ${size}px;" data-keyword="${item.keyword}">
                    ${item.keyword}
                    <small>${item.count}</small>
                </span>
            `;
            })
            .join("");

        container.querySelectorAll(".search-tag").forEach((tag) => {
            tag.addEventListener("click", () => {
                const keyword = tag.getAttribute("data-keyword") || tag.textContent.trim().split("\n")[0].trim();

                // 同时处理移动端和桌面端搜索框
                const mobileInput = document.getElementById("global-search");
                const desktopInput = document.getElementById("global-search-desktop");

                // 设置两个搜索框的值并触发事件
                [mobileInput, desktopInput].forEach((input) => {
                    if (input) {
                        input.value = keyword;
                        input.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                });

                // 聚焦并滚动到搜索框（优先桌面端，移动端备用）
                const targetInput = desktopInput || mobileInput;
                if (targetInput) {
                    targetInput.focus();
                    targetInput.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            });
        });
    } catch (error) {
        console.error("搜索关键词统计加载失败", error);
        container.innerHTML = '<p class="empty-tip">暂无搜索数据</p>';
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadSearchStats);
} else {
    loadSearchStats();
}
