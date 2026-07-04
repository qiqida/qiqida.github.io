// ==========================
// 留言反馈面板
// 桌面端 (>768px)：分屏效果，主页和面板同时可见
// 移动端 (≤768px)：全屏滑动，主页完全滑出
// ==========================

function initFeedbackFloat() {
    const floatBtn = document.getElementById("feedback-float-btn");
    const panel = document.getElementById("feedback-panel");
    const closeBtn = document.getElementById("feedback-panel-close");
    const form = document.getElementById("feedback-form");
    const pageRoot = document.getElementById("page-root");

    if (!floatBtn || !panel) return;

    const PANEL_WIDTH = 380; // 面板宽度
    const ANIM_DURATION = 350; // ms

    let isOpen = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let startTime = 0;

    // 检测是否为桌面端
    function isDesktop() {
        return window.innerWidth > 768;
    }

    // 动态获取面板宽度
    function getPanelWidth() {
        return Math.min(PANEL_WIDTH, window.innerWidth * (isDesktop() ? 0.9 : 1));
    }

    function setPosition(open, animate) {
        const duration = animate ? `${ANIM_DURATION}ms` : "0ms";
        const panelW = getPanelWidth();

        if (open) {
            if (isDesktop()) {
                // 桌面端：分屏效果，主页右移面板宽度，面板紧贴左边
                if (pageRoot) {
                    pageRoot.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
                    pageRoot.style.transform = `translateX(${panelW}px)`;
                }
                panel.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
                panel.style.transform = "translateX(0)";
            } else {
                // 移动端：主页完全滑出，面板覆盖全屏
                if (pageRoot) {
                    pageRoot.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
                    pageRoot.style.transform = "translateX(100%)";
                }
                panel.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
                panel.style.transform = "translateX(0)";
            }
            floatBtn.style.opacity = "0";
            floatBtn.style.pointerEvents = "none";
        } else {
            // 关闭
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

    // --- 反馈页：左滑关闭 ---
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

        if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 10) return;

        const offset = Math.min(0, dx); // 只允许向左拖
        const panelW = getPanelWidth();

        if (isDesktop()) {
            // 桌面端：面板固定宽度，只滑出当前拖动的距离
            panel.style.transform = `translateX(${offset}px)`;
            if (pageRoot) {
                pageRoot.style.transform = `translateX(${panelW + offset}px)`;
            }
        } else {
            // 移动端：全屏滑动
            panel.style.transform = `translateX(${offset}px)`;
            if (pageRoot) {
                pageRoot.style.transform = `translateX(calc(100% + ${offset}px))`;
            }
        }
        currentX = offset;
        if (Math.abs(dx) > 10) e.preventDefault();
    }

    function onTouchEnd() {
        if (!isDragging) return;
        isDragging = false;
        const elapsed = Date.now() - startTime;
        const velocity = elapsed > 0 ? Math.abs(currentX) / elapsed : 0;
        const threshold = getPanelWidth() * 0.3;

        if (currentX < -threshold || velocity > 0.5) {
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

        const panelW = getPanelWidth();
        let offset, panelOffset;

        if (isDesktop()) {
            // 桌面端：主页右滑时只能滑到面板宽度
            offset = Math.max(0, Math.min(panelW, dx));
            panelOffset = -panelW + offset;
        } else {
            // 移动端：主页完全滑出
            const maxOffset = pageRoot ? pageRoot.offsetWidth : window.innerWidth;
            offset = Math.max(0, Math.min(maxOffset, dx));
            panelOffset = -maxOffset + offset;
        }

        if (pageRoot) {
            pageRoot.style.transform = `translateX(${offset}px)`;
        }
        panel.style.transition = "none";
        panel.style.transform = `translateX(${panelOffset}px)`;
        currentX = offset;
        if (Math.abs(dx) > 10) e.preventDefault();
    }

    function onHomeTouchEnd() {
        if (!isDragging || isOpen) return;
        isDragging = false;
        const elapsed = Date.now() - startTime;
        const velocity = elapsed > 0 ? currentX / elapsed : 0;
        const threshold = getPanelWidth() * 0.3;

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
