// 通知列表页

async function loadNoticesList() {
    const container = document.getElementById("notices-list-container");
    if (!container) return;

    try {
        const response = await fetch("../data/notices.json");
        const notices = await response.json();

        notices.forEach(notice => {
            const card = document.createElement("div");
            card.className = "notice-card";
            card.style.cursor = "pointer";

            card.innerHTML = `
                <h3>${notice.title}</h3>
                <p>${notice.date}</p>
                <small>${notice.summary}</small>
            `;

            card.onclick = () => {
                if (typeof gtag !== "undefined") {
                    gtag("event", "notice_click", {
                        notice_title: notice.title,
                        notice_id: notice.id
                    });
                }
                window.location.href = `notice.html?id=${notice.id}`;
            };

            container.appendChild(card);
        });
    } catch (error) {
        console.error("通知列表加载失败", error);
        container.innerHTML = "<p>通知加载失败，请稍后重试。</p>";
    }
}

loadNoticesList();
