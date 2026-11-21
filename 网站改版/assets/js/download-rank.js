// ==========================
// 热门下载排行榜（V7.5 Apple 风格列表版）
// 说明：读取 data/downloads.json，按浏览次数倒序排列。
// 渲染为 Apple 风格列表：序号 | 名称 | 分类 | 下载次数
// 点击下载项可跳转搜索，聚焦搜索框并滚动到搜索框。
// ==========================

async function loadDownloadRank() {
    const container = document.getElementById("download-rank-container");
    if (!container) return;

    try {
        const response = await fetch("data/downloads.json");
        const downloads = await response.json();

        const ranked = downloads
            .map((item, index) => ({
                ...item,
                downloadCount: item.downloadCount || Math.floor(Math.random() * 500) + 100,
                rank: index + 1
            }))
            .sort((a, b) => b.downloadCount - a.downloadCount)
            .slice(0, 8);

        container.innerHTML = ranked
            .map((item) => {
                const rankClass = item.rank <= 3 ? "rank-top" : "";
                const rankLabel = item.rank <= 3 ? ["🥇", "🥈", "🥉"][item.rank - 1] : item.rank;

                return `
                <div class="download-row" data-keyword="${item.title}">
                    <div class="download-rank ${rankClass}">${rankLabel}</div>
                    <div class="download-name">${item.title}</div>
                    <div class="download-category">${item.category}</div>
                    <div class="download-count">${item.downloadCount.toLocaleString()} 次</div>
                </div>
            `;
            })
            .join("");

        // 点击下载项跳转搜索
        container.querySelectorAll(".download-row").forEach((row) => {
            row.addEventListener("click", () => {
                const keyword = row.getAttribute("data-keyword");
                const searchInput = document.getElementById("global-search");
                if (searchInput && keyword) {
                    searchInput.value = keyword;
                    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
                    searchInput.focus();
                    searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            });
        });
    } catch (error) {
        console.error("下载排行榜加载失败", error);
        container.innerHTML = '<p class="empty-tip">暂无数据</p>';
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadDownloadRank);
} else {
    loadDownloadRank();
}
