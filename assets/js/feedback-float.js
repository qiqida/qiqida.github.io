// ==========================
// 左侧悬浮反馈按钮与面板
// 说明：点击左侧浮动按钮，从左侧滑出反馈面板。
// 支持姓名（可选）、留言内容、提交按钮，并接入问卷星链接。
// ==========================

function initFeedbackFloat() {
    const floatBtn = document.getElementById("feedback-float-btn");
    const panel = document.getElementById("feedback-panel");
    const closeBtn = document.getElementById("feedback-panel-close");
    const form = document.getElementById("feedback-form");

    if (!floatBtn || !panel) return;

    // 打开面板
    floatBtn.addEventListener("click", function() {
        panel.classList.add("open");
        floatBtn.style.opacity = "0";
        floatBtn.style.pointerEvents = "none";
    });

    // 关闭面板
    function closePanel() {
        panel.classList.remove("open");
        floatBtn.style.opacity = "1";
        floatBtn.style.pointerEvents = "auto";
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", closePanel);
    }

    // 点击面板外部关闭（遮罩层逻辑通过 body 点击）
    document.addEventListener("click", function(event) {
        if (
            panel.classList.contains("open") &&
            !panel.contains(event.target) &&
            event.target !== floatBtn &&
            !floatBtn.contains(event.target)
        ) {
            closePanel();
        }
    });

    // 表单提交（演示用途，实际需对接后端）
    if (form) {
        form.addEventListener("submit", function(event) {
            event.preventDefault();

            const nameInput = document.getElementById("feedback-name");
            const contentInput = document.getElementById("feedback-content");

            const name = nameInput ? nameInput.value.trim() : "";
            const content = contentInput ? contentInput.value.trim() : "";

            if (!content) {
                alert("请输入留言内容");
                return;
            }

            // 演示：记录到控制台并提示
            console.log("反馈提交:", { name, content });

            // 此处可扩展为：
            // 1. 提交到 Giscus（留言墙）
            // 2. 提交到问卷星（通过 URL 参数传递）
            // 3. 提交到后端 API

            alert("感谢您的反馈！（演示模式）");

            // 清空表单并关闭面板
            form.reset();
            closePanel();
        });
    }

    // ESC 键关闭面板
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape" && panel.classList.contains("open")) {
            closePanel();
        }
    });
}

// 页面加载完成后初始化
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFeedbackFloat);
} else {
    initFeedbackFloat();
}
