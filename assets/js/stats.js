// ==========================
// 首页「站点内容」数字
//
// 数据来自 data/site-stats.json，由 tools/assets.py 在构建时算好。
// 这几个数字都是**站内实际有多少**，不是编的。
//
// 之前这里去请求 Cloudflare Worker 拿访问量，那个接口挂了，
// 页面就一直显示「—」。现在改成只显示站内能算准的数字；
// 访问量请看 Google Analytics。
// ==========================

function formatNumber(num) {
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + "万";
    }
    return num.toLocaleString("zh-CN");
}

async function loadStats() {
    const map = {
        "stat-files": "files",
        "stat-pages": "pages",
        "stat-zones": "zones",
        "stat-faq": "faq",
    };

    const els = {};
    for (const id of Object.keys(map)) {
        els[id] = document.getElementById(id);
    }

    // 一个都没找到（这个区块可能没渲染）就跳过
    const hasAny = Object.keys(map).some((id) => els[id]);
    if (!hasAny) return;

    try {
        const response = await fetch("data/site-stats.json");
        if (!response.ok) throw new Error("HTTP " + response.status);
        const stats = await response.json();

        for (const id of Object.keys(map)) {
            const el = els[id];
            if (!el) continue;
            const value = stats[map[id]];
            el.textContent = (typeof value === "number") ? formatNumber(value) : "—";
        }
    } catch (error) {
        console.warn("站点统计加载失败", error);
        // 取不到就留「—」，不显示假数字
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadStats);
} else {
    loadStats();
}
