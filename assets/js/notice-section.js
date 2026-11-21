// ==========================
// 首页「重要通知」区块
// —— 置顶通知用大卡片突出显示，普通通知用紧凑行
// 置顶通知 = 长期有效、对所有同学都适用（如「这个网站怎么用」）
// ==========================

async function loadNotices() {
    const container = document.getElementById("notice-container");
    if (!container) return;

    try {
        const response = await fetch("data/notices.json?v=" + Date.now());

        if (!response.ok) {
            throw new Error("通知数据读取失败");
        }

        const notices = await response.json();
        const list = Array.isArray(notices) ? notices : [];

        // 置顶在前，其余按日期倒序
        const pinned = list.filter(function (n) { return n.pinned; });
        const normal = list
            .filter(function (n) { return !n.pinned; })
            .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });

        const pinnedShown = pinned.slice(0, 1);
        const normalShown = normal.slice(0, 4);

        if (pinnedShown.length === 0 && normalShown.length === 0) {
            container.innerHTML = '<div class="notice-empty">暂无通知。</div>';
            return;
        }

        container.innerHTML = "";

        // 置顶通知（大卡片）
        pinnedShown.forEach(function (notice) {
            const card = document.createElement("a");
            card.className = "notice-card-pinned";
            card.href = "pages/notice-" + encodeURIComponent(notice.id) + ".html";

            card.innerHTML = `
                <h3>
                    <span class="pinned-badge">重要通知</span>
                    ${escapeHtml(notice.title)}
                </h3>
                <p>${escapeHtml(notice.summary || "")}</p>
                <span class="notice-more">查看详情 →</span>
            `;

            trackNoticeClick(notice);
            container.appendChild(card);
        });

        // 普通通知（紧凑行）
        normalShown.forEach(function (notice) {
            const row = document.createElement("a");
            row.className = "notice-row";
            row.href = "pages/notice-" + encodeURIComponent(notice.id) + ".html";

            row.innerHTML = `
                <span class="notice-row-date">${escapeHtml(notice.date || "")}</span>
                <span class="notice-row-title">${escapeHtml(notice.title)}</span>
                <span class="notice-row-arrow">›</span>
            `;

            trackNoticeClick(notice);
            container.appendChild(row);
        });
    } catch (error) {
        console.error("通知加载失败", error);
        container.innerHTML = '<div class="notice-empty">通知加载失败，请稍后重试。</div>';
    }
}

function trackNoticeClick(notice) {
    if (typeof gtag === "undefined") return;

    gtag("event", "notice_click", {
        notice_title: notice.title,
        notice_id: notice.id
    });
}

function escapeHtml(text) {
    return String(text == null ? "" : text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

loadNotices();
