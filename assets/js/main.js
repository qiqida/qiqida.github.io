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

        notices.forEach(notice => {

            const card =
                document.createElement("div");

            card.className =
                "notice-card";

           card.innerHTML = `

    <h3>${notice.title}</h3>

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
