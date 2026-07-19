// 首页：加载通知列表

async function loadNotices() {

    try {

        const response =
            await fetch("data/notices.json");

        const notices =
            await response.json();

        const container =
            document.getElementById(
                "notice-container"
            );

        if (!container) return;

        // 分离置顶和非置顶通知
        const pinned = notices.filter(n => n.pinned);
        const unpinned = notices.filter(n => !n.pinned);

        // 合并：置顶在前（最多3个），非置顶在后，总共最多5个
        const sortedNotices = [
            ...pinned.slice(0, 3),
            ...unpinned
        ].slice(0, 5);

        sortedNotices.forEach(notice => {

            const card =
                document.createElement("div");

            card.className =
                "notice-card";

            // 置顶标签
            const pinnedBadge = notice.pinned
                ? '<span class="pinned-badge">置顶</span>'
                : '';

            card.innerHTML = `

    <h3>${pinnedBadge}${notice.title}</h3>

    <p>${notice.date}</p>

    <small>

        ${notice.summary}

    </small>

`;


card.style.cursor = "pointer";

card.onclick = () => {

    if (typeof gtag !== "undefined") {
        gtag('event', 'notice_click', {
            'notice_title': notice.title,
            'notice_id': notice.id
        });
    }

    window.location.href =
        `pages/notice.html?id=${notice.id}`;
};

            container.appendChild(card);

        });

    } catch (error) {

        console.error(
            "通知加载失败",
            error
        );

    }

}

loadNotices();
