async function loadDownloads() {

    const response = await fetch("../data/downloads.json");
    const downloads = await response.json();

    const categoryMap = {
        "事务办理": "download-container-leave",
        "学术活动": "download-container-academic",
        "毕业专区": "download-container-graduation"
    };

    downloads.forEach(item => {

        const containerId = categoryMap[item.category] || "download-container-leave";
        const container = document.getElementById(containerId);
        if (!container) return;

        const card = document.createElement("div");
        card.className = "download-item";

        card.innerHTML = `
            <div>
                <h3>${item.title}</h3>
                <p>${item.category} · ${item.date}</p>
            </div>
            <a href="../${item.file}" class="download-btn" download>
                下载
            </a>
        `;

        card.querySelector("a").addEventListener("click", () => {
            if (typeof gtag !== "undefined") {
                gtag("event", "file_download", {
                    file_name: item.title
                });
            }
        });

        container.appendChild(card);
    });
}

loadDownloads();
