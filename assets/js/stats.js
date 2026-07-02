// 首页数据中心：从 JSON 自动统计文件数、FAQ 数、通知数
// V7.5 统一数据源，避免重复统计

async function loadStats() {
    const visitEl = document.getElementById("stat-visits");
    const filesEl = document.getElementById("stat-files");
    const faqEl = document.getElementById("stat-faq");
    const noticesEl = document.getElementById("stat-notices");

    if (!visitEl) return;

    try {
        const [statsRes, downloadsRes, faqRes, gradFaqRes, freshFaqRes, noticesRes] =
            await Promise.all([
                fetch("data/stats.json"),
                fetch("data/downloads.json"),
                fetch("data/faq.json"),
                fetch("data/graduation-faq.json"),
                fetch("data/freshman-faq.json"),
                fetch("data/notices.json")
            ]);

        const stats = await statsRes.json();
        const downloads = await downloadsRes.json();
        const faqs = await faqRes.json();
        const gradFaqs = await gradFaqRes.json();
        const freshFaqs = await freshFaqRes.json();
        const notices = await noticesRes.json();

        const faqCount = faqs.length + gradFaqs.length + freshFaqs.length;

        visitEl.textContent = Number(stats.visit || 0).toLocaleString();
        filesEl.textContent = downloads.length;
        faqEl.textContent = faqCount;
        noticesEl.textContent = notices.length;
    } catch (error) {
        console.error("统计数据加载失败", error);
    }
}

loadStats();
