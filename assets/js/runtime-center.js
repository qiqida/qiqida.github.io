// ==========================
// 网站运行数据中心（V7.5 底部精简版）
// 说明：仅保留底部迷你统计，隐藏详细图表。
// ==========================

async function loadRuntimeCenter() {
    const uptimeEl = document.getElementById("runtime-uptime");
    const totalEl = document.getElementById("runtime-total");
    const todayEl = document.getElementById("runtime-today");
    const activeEl = document.getElementById("runtime-active");
    const container = document.getElementById("runtime-center-container");

    if (!container) return;

    try {
        const response = await fetch("data/runtime-stats.json");
        const stats = await response.json();

        if (uptimeEl) uptimeEl.textContent = stats.uptime || "—";
        if (totalEl) totalEl.textContent = (stats.totalVisits || 0).toLocaleString();
        if (todayEl) todayEl.textContent = (stats.todayVisits || 0).toLocaleString();
        if (activeEl) activeEl.textContent = stats.activeUsers || 0;

        // 隐藏详细图表区域，保持底部精简
        container.innerHTML = "";
    } catch (error) {
        console.error("运行数据中心加载失败", error);
        if (uptimeEl) uptimeEl.textContent = "—";
        if (totalEl) totalEl.textContent = "—";
        if (todayEl) todayEl.textContent = "—";
        if (activeEl) activeEl.textContent = "—";
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadRuntimeCenter);
} else {
    loadRuntimeCenter();
}
