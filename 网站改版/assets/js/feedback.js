// 意见反馈：跳转问卷星（链接在 data/site-config.json 维护）

async function initFeedback() {
    const btn = document.querySelector(".feedback-btn");
    if (!btn) return;

    try {
        const response = await fetch("data/site-config.json");
        const config = await response.json();

        if (config.feedbackUrl) {
            btn.addEventListener("click", () => {
                if (typeof gtag !== "undefined") {
                    gtag("event", "feedback_click");
                }
                window.open(config.feedbackUrl, "_blank", "noopener,noreferrer");
            });
        }
    } catch (error) {
        console.error("反馈配置加载失败", error);
    }
}

initFeedback();
