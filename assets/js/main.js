// 深色模式切换

const toggleBtn = document.getElementById("theme-toggle");

toggleBtn.addEventListener("click", () => {

    const currentTheme =
        document.documentElement.getAttribute("data-theme");

    if (currentTheme === "dark") {

        document.documentElement.removeAttribute("data-theme");

        toggleBtn.textContent = "🌙";

    } else {

        document.documentElement.setAttribute(
            "data-theme",
            "dark"
        );

        toggleBtn.textContent = "☀️";
    }
});

// =========================
// 加载通知数据
// =========================

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

    // GA事件（非常重要）
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
