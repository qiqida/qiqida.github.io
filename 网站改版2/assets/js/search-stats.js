// ==========================
// 常见搜索词（首页）
//
// 数据来自 data/search-stats.json，由 tools/assets.py 生成。
// 这一组词是「学生最常搜的几件事」，**不标搜索次数** ——
// 之前的 count 是编的，标出来反而不准。
//
// 点一下就把词填进搜索框并聚焦，方便直接看结果。
// ==========================

async function loadSearchStats() {
    const container = document.getElementById("search-stats-container");
    if (!container) return;

    try {
        const response = await fetch("data/search-stats.json");
        if (!response.ok) throw new Error("HTTP " + response.status);
        const stats = await response.json();

        if (!Array.isArray(stats) || stats.length === 0) {
            throw new Error("没有搜索词数据");
        }

        // 所有词用同一样式。
        // 之前按 count 算字号，词有大有小，看起来像「有人搜得多」，
        // 现在不标次数，大小统一，视觉上更干净。
        container.innerHTML = stats
            .map((item) => {
                const keyword = item.keyword || "";
                if (!keyword) return "";
                return `
                <button type="button" class="search-tag" data-keyword="${keyword}">
                    ${keyword}
                </button>`;
            })
            .join("");

        container.querySelectorAll(".search-tag").forEach((tag) => {
            tag.addEventListener("click", () => {
                const keyword = tag.getAttribute("data-keyword") || tag.textContent.trim();

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
        console.error("常见搜索词加载失败", error);
        container.innerHTML = '<p class="empty-tip">暂无搜索词数据</p>';
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadSearchStats);
} else {
    loadSearchStats();
}
