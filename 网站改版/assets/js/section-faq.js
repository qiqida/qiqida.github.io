// 专区 FAQ 加载：在页面容器上设置 data-faq-src 即可

async function loadSectionFAQ() {
    const container = document.getElementById("section-faq-container");
    if (!container) return;

    const src = container.dataset.faqSrc;
    if (!src) return;

    try {
        const response = await fetch(src);
        const faqs = await response.json();

        faqs.forEach(item => {
            const card = document.createElement("div");
            card.className = "faq-card";
            card.innerHTML = `
                <h3>${item.question}</h3>
                <p>${item.answer}</p>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("专区 FAQ 加载失败", error);
    }
}

loadSectionFAQ();
