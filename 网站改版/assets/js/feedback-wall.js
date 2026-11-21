// ==========================
// 留言反馈墙（Giscus）
// 说明：根据 data/site-config.json 中的 giscus 配置初始化 Giscus 组件。
// 用户点击主页左侧按钮可展开/收起留言板。
// ==========================

let giscusLoaded = false;

// 加载站点配置
async function loadSiteConfig() {
    try {
        const response = await fetch("data/site-config.json");
        return await response.json();
    } catch (error) {
        console.error("站点配置加载失败", error);
        return null;
    }
}

// 创建 Giscus script 标签
function createGiscusScript(config) {
    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.setAttribute("data-repo", config.giscusRepo || "");
    script.setAttribute("data-repo-id", config.giscusRepoId || "");
    script.setAttribute("data-category", config.giscusCategory || "General");
    script.setAttribute("data-category-id", config.giscusCategoryId || "");
    script.setAttribute("data-mapping", config.giscusMapping || "pathname");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", config.giscusPosition || "top");
    script.setAttribute("data-lang", "zh-CN");
    script.setAttribute("data-theme", "preferred_color_scheme");
    script.crossOrigin = "anonymous";
    script.async = true;
    return script;
}

// 初始化留言反馈墙
async function initFeedbackWall() {
    const config = await loadSiteConfig();
    if (!config || !config.giscusRepo) {
        console.warn("Giscus 配置缺失，请在 data/site-config.json 中配置 giscus 相关字段。");
        return;
    }

    const wall = document.getElementById("feedback-wall");
    if (!wall) return;

    const container = document.getElementById("giscus-container");

    // 创建切换按钮
    const toggleBtn = document.getElementById("feedback-wall-toggle");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", function() {
            if (wall.classList.contains("open")) {
                wall.classList.remove("open");
                toggleBtn.textContent = "💬 留言反馈";
                toggleBtn.setAttribute("aria-expanded", "false");
            } else {
                wall.classList.add("open");
                toggleBtn.textContent = "✕ 关闭留言";
                toggleBtn.setAttribute("aria-expanded", "true");
            }
        });
    }

    // 懒加载 Giscus（首次展开时加载）
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === "class") {
                if (wall.classList.contains("open") && !giscusLoaded) {
                    giscusLoaded = true;
                    if (container && !container.hasChildNodes()) {
                        const script = createGiscusScript(config);
                        container.appendChild(script);
                    }
                }
            }
        });
    });

    observer.observe(wall, { attributes: true });
}

// 页面加载完成后初始化
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFeedbackWall);
} else {
    initFeedbackWall();
}
