async function loadDownloads() {

    const response = await fetch("../data/downloads.json");
    const downloads = await response.json();

    const container = document.getElementById("download-container");

    downloads.forEach(item => {

        const card = document.createElement("div");
        card.className = "download-item";

        card.innerHTML = `
            <div>
                <h3>${item.title}</h3>
                <p>${item.category} · ${item.date}</p>
            </div>

            <a href="../${item.file}" class="download-btn">
                下载
            </a>
        `;

        // GA下载统计
        card.querySelector("a").onclick = () => {

            if (typeof gtag !== "undefined") {
                gtag('event', 'file_download', {
                    'file_name': item.title
                });
            }

        };

        container.appendChild(card);

    });

}

loadDownloads();