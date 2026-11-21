// 意见反馈：跳转问卷星
//
// 链接地址在 data/site-config.json 里维护（feedbackUrl）。
// 说明：
//   - 该文件缺失或读取失败时，不绑定点击事件，避免「点了没反应」又查不出原因；
//   - 问卷星地址还是官方示例地址时，同样不绑定；
//   - 实际可用的入口是首页右下角的留言面板（feedback-float.js），走本站后端。

// 全站共用一份配置，避免首页多个脚本重复 fetch
window.SITE_CONFIG = window.SITE_CONFIG || null;

async function loadSiteConfig() {
    if (window.SITE_CONFIG) return window.SITE_CONFIG;
    try {
        const response = await fetch("data/site-config.json?v=" + (window.SITE_VER || "1"));
        if (!response.ok) throw new Error("配置读取失败 HTTP " + response.status);
        window.SITE_CONFIG = await response.json();
    } catch (error) {
        console.warn("站点配置加载失败", error);
        window.SITE_CONFIG = null;
    }
    return window.SITE_CONFIG;
}

// 判断问卷星地址是否「已真正配置」
function isSurveyConfigured(url) {
    if (!url) return false;
    const v = String(url).trim();
    if (!v || v === "#") return false;
    if (v.indexOf("/vm/example.aspx") >= 0) return false;   // 官方示例地址
    return true;
}

async function initFeedback() {
    const btn = document.querySelector(".feedback-btn");
    if (!btn) return;

    const config = await loadSiteConfig();
    const url = config ? config.feedbackUrl : "";

    if (!isSurveyConfigured(url)) {
        console.info("问卷星入口未配置，已跳过绑定（留言面板仍可用）");
        return;
    }

    btn.addEventListener("click", () => {
        if (typeof gtag !== "undefined") {
            gtag("event", "feedback_click");
        }
        window.open(url, "_blank", "noopener,noreferrer");
    });
}

initFeedback();
