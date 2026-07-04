// ==========================
// 留言反馈面板
// 交互：主页右滑出 → 反馈页左滑入，两个页面完全独立切换。
// 打开方式：点击浮动按钮，或主页右滑。
// 关闭方式：点击关闭按钮 / 反馈页左滑 / Esc 键。
// ==========================

function initFeedbackFloat() {
    const floatBtn = document.getElementById("feedback-float-btn");
    const panel = document.getElementById("feedback-panel");
    const closeBtn = document.getElementById("feedback-panel-close");
    const form = document.getElementById("feedback-form");
    const pageRoot = document.getElementById("page-root");

    if (!floatBtn || !panel) return;

    // 隐藏手势指示条（手机端不再需要）
    const gestureBar = document.createElement("div");
    gestureBar.className = "feedback-panel-gesture";
    panel.insertBefore(gestureBar, panel.firstChild);

    let isOpen = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let startTime = 0;

    const ANIM_DURATION = 400; // ms，与 CSS transition 保持一致

    function setPosition(open, animate) {
        const duration = animate ? `${ANIM_DURATION}ms` : "0ms";

        if (open) {
            // 打开：主页右滑出，反馈页左滑入
            if (pageRoot) {
                pageRoot.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
                pageRoot.style.transform = "translateX(100vw)";
            }
            panel.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
            panel.style.transform = "translateX(0)";
            floatBtn.style.opacity = "0";
            floatBtn.style.pointerEvents = "none";
        } else {
            // 关闭：主页右滑回，反馈页左滑出
            if (pageRoot) {
                pageRoot.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
                pageRoot.style.transform = "translateX(0)";
            }
            panel.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
            panel.style.transform = "translateX(-100%)";
            floatBtn.style.opacity = "1";
            floatBtn.style.pointerEvents = "auto";
        }

        isOpen = open;
        panel.setAttribute("aria-hidden", open ? "false" : "true");
    }

    function openPanel() {
        if (isOpen) return;
        setPosition(true, true);
    }

    function closePanel() {
        if (!isOpen) return;
        setPosition(false, true);
    }

    // --- 关闭按钮 ---
    if (closeBtn) {
        closeBtn.addEventListener("click", closePanel);
    }

    // --- 浮动按钮 ---
    floatBtn.addEventListener("click", openPanel);

    // --- Esc 键 ---
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && isOpen) closePanel();
    });

    // --- 反馈页：左滑关闭（手势指示条区域 + 面板主体）---
    function onTouchStart(e) {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        startTime = Date.now();
        isDragging = true;
        panel.style.transition = "none";
        if (pageRoot) pageRoot.style.transition = "none";
    }

    function onTouchMove(e) {
        if (!isDragging || !isOpen) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        // 优先响应水平
        if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 10) return;
        const offset = Math.min(0, dx); // 只允许向左拖
        panel.style.transform = `translateX(${offset}px)`;
        if (pageRoot) {
            pageRoot.style.transform = `translateX(calc(100vw + ${offset}px))`;
        }
        currentX = offset;
        if (Math.abs(dx) > 10) e.preventDefault();
    }

    function onTouchEnd() {
        if (!isDragging) return;
        isDragging = false;
        const elapsed = Date.now() - startTime;
        const velocity = elapsed > 0 ? currentX / elapsed : 0;
        const threshold = window.innerWidth * 0.3;
        if (currentX < -threshold || velocity < -0.4) {
            closePanel();
        } else {
            setPosition(true, true); // 弹回
        }
    }

    panel.addEventListener("touchstart", onTouchStart, { passive: false });
    panel.addEventListener("touchmove", onTouchMove, { passive: false });
    panel.addEventListener("touchend", onTouchEnd);
    panel.addEventListener("touchcancel", onTouchEnd);

    // --- 主页：右滑打开（仅手机端，非输入框聚焦时）---
    function onHomeTouchStart(e) {
        if (isOpen) return;
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        // 仅从屏幕左边缘开始才响应右滑打开
        if (t.clientX > 30) return;
        startX = t.clientX;
        startY = t.clientY;
        startTime = Date.now();
        isDragging = true;
        if (pageRoot) pageRoot.style.transition = "none";
    }

    function onHomeTouchMove(e) {
        if (!isDragging || isOpen) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 10) return;
        const offset = Math.max(0, Math.min(window.innerWidth, dx));
        if (pageRoot) {
            pageRoot.style.transform = `translateX(${offset}px)`;
        }
        panel.style.transition = "none";
        panel.style.transform = `translateX(${-window.innerWidth + offset}px)`;
        currentX = offset;
        if (Math.abs(dx) > 10) e.preventDefault();
    }

    function onHomeTouchEnd() {
        if (!isDragging || isOpen) return;
        isDragging = false;
        const elapsed = Date.now() - startTime;
        const velocity = elapsed > 0 ? currentX / elapsed : 0;
        const threshold = window.innerWidth * 0.3;
        if (currentX > threshold || velocity > 0.4) {
            openPanel();
        } else {
            setPosition(false, true); // 弹回
        }
    }

    if (pageRoot) {
        pageRoot.addEventListener("touchstart", onHomeTouchStart, { passive: false });
        pageRoot.addEventListener("touchmove", onHomeTouchMove, { passive: false });
        pageRoot.addEventListener("touchend", onHomeTouchEnd);
        pageRoot.addEventListener("touchcancel", onHomeTouchEnd);
    }

    // --- 表单提交 ---
    if (form) {
        form.addEventListener("submit", function(e) {
            e.preventDefault();
            const nameInput = document.getElementById("feedback-name");
            const contentInput = document.getElementById("feedback-content");
            const name = nameInput ? nameInput.value.trim() : "";
            const content = contentInput ? contentInput.value.trim() : "";
            if (!content) {
                alert("请输入留言内容");
                return;
            }
            console.log("反馈提交:", { name, content });
            alert("感谢您的反馈！（演示模式）");
            form.reset();
            closePanel();
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFeedbackFloat);
} else {
    initFeedbackFloat();
}
