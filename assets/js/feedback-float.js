// ==========================
// 左侧悬浮反馈按钮与面板
// 说明：点击左侧浮动按钮，从左侧滑出反馈面板。
// 支持姓名（可选）、留言内容、提交按钮，并接入问卷星链接。
// 支持遮罩层、手势指示条、滑动关闭。
// ==========================

function initFeedbackFloat() {
    const floatBtn = document.getElementById("feedback-float-btn");
    const panel = document.getElementById("feedback-panel");
    const closeBtn = document.getElementById("feedback-panel-close");
    const form = document.getElementById("feedback-form");

    if (!floatBtn || !panel) return;

    // 创建遮罩层
    let overlay = document.querySelector(".feedback-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "feedback-overlay";
        document.body.appendChild(overlay);
    }

    // 添加手势指示条
    const gestureBar = document.createElement("div");
    gestureBar.className = "feedback-panel-gesture";
    panel.insertBefore(gestureBar, panel.firstChild);

    // 打开面板
    function openPanel() {
        panel.classList.add("open");
        overlay.classList.add("active");
        floatBtn.style.opacity = "0";
        floatBtn.style.pointerEvents = "none";
        document.body.style.overflow = "hidden";
    }

    // 关闭面板
    function closePanel() {
        panel.classList.remove("open");
        overlay.classList.remove("active");
        floatBtn.style.opacity = "1";
        floatBtn.style.pointerEvents = "auto";
        document.body.style.overflow = "";
    }

    // 打开按钮
    floatBtn.addEventListener("click", openPanel);

    // 关闭按钮
    if (closeBtn) {
        closeBtn.addEventListener("click", closePanel);
    }

    // 点击遮罩层关闭
    overlay.addEventListener("click", closePanel);

    // 手势滑动关闭（移动端）
    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;

    panel.addEventListener("touchstart", function(e) {
        // 只在面板左侧区域或手势条上开始拖动
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isDragging = true;
        panel.style.transition = "none";
    }, { passive: true });

    panel.addEventListener("touchmove", function(e) {
        if (!isDragging) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;

        // 只处理水平滑动（且向左滑）
        if (deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY)) {
            const translateX = Math.min(0, deltaX);
            panel.style.transform = `translateX(${translateX}px)`;

            // 更新遮罩透明度
            const progress = Math.abs(deltaX) / 380;
            overlay.style.opacity = (1 - progress).toString();
        }
    }, { passive: true });

    panel.addEventListener("touchend", function(e) {
        if (!isDragging) return;
        isDragging = false;
        panel.style.transition = "";

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;

        // 滑动超过 100px 或松手时速度较快则关闭
        if (deltaX < -100) {
            closePanel();
        } else {
            panel.style.transform = "";
            overlay.style.opacity = "";
        }
    });

    // ESC 键关闭面板
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape" && panel.classList.contains("open")) {
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
}

// 页面加载完成后初始化
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFeedbackFloat);
} else {
    initFeedbackFloat();
}
