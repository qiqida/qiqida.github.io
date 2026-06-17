async function loadNotice() {

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    const response = await fetch("../data/notices.json");
    const notices = await response.json();

    const notice = notices.find(item => item.id === id);

    if (!notice) return;

    document.getElementById("notice-title").textContent = notice.title;
    document.getElementById("notice-date").textContent = notice.date;

    document.getElementById("notice-content").innerHTML = `
        <div class="notice-content-box">
            ${notice.content}
        </div>
    `;

    // GA页面访问
    if (typeof gtag !== "undefined") {
        gtag('event', 'notice_view', {
            'notice_title': notice.title,
            'notice_id': notice.id
        });
    }
}

loadNotice();