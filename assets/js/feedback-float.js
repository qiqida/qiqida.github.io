// ==========================
// 留言反馈面板
// 手机端：全屏滑动，左滑关闭
// 桌面端：分屏效果
// ==========================

function initFeedbackFloat() {
    const floatBtn = document.getElementById("feedback-float-btn");
    const panel = document.getElementById("feedback-panel");
    const closeBtn = document.getElementById("feedback-panel-close");
    const form = document.getElementById("feedback-form");
    const pageRoot = document.getElementById("page-root");

    if (!floatBtn || !panel) return;

    const ANIM_DURATION = 300;

    let isOpen = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let dragOffset = 0;
    let startTime = 0;

    function isDesktop() {
        return window.innerWidth > 768;
    }

    function getPanelWidth() {
        return Math.min(380, window.innerWidth * (isDesktop() ? 0.9 : 1));
    }

    // 强制重排以确保样式立即应用
    function forceReflow(el) {
        if (el) el.offsetHeight;
    }

    // 重置所有 transform 到初始状态
    function resetAllTransforms() {
        panel.style.transition = "none";
        panel.style.transform = "";
        panel.style.willChange = "";

        if (pageRoot) {
            pageRoot.style.transition = "none";
            pageRoot.style.transform = "";
            pageRoot.style.willChange = "";
        }

        forceReflow(panel);
        forceReflow(pageRoot);
    }

    function openPanel(animate = true) {
        if (isOpen) return;
        isOpen = true;

        const duration = animate ? `${ANIM_DURATION}ms` : "0ms";
        const panelW = getPanelWidth();

        panel.style.willChange = "transform";
        panel.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
        panel.style.transform = "translateX(0)";

        if (pageRoot) {
            pageRoot.style.willChange = "transform";
            pageRoot.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
            pageRoot.style.transform = isDesktop() ? `translateX(${panelW}px)` : "translateX(100%)";
        }

        floatBtn.style.opacity = "0";
        floatBtn.style.pointerEvents = "none";
        panel.setAttribute("aria-hidden", "false");
    }

    function closePanel(animate = true) {
        if (!isOpen) return;
        isOpen = false;

        const duration = animate ? `${ANIM_DURATION}ms` : "0ms";

        panel.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
        panel.style.transform = "translateX(-100%)";

        if (pageRoot) {
            pageRoot.style.transition = `transform ${duration} cubic-bezier(0.4,0,0.2,1)`;
            pageRoot.style.transform = "translateX(0)";
        }

        // 动画结束后清理
        setTimeout(() => {
            if (!isOpen) {
                panel.style.willChange = "";
                panel.style.transition = "none";
                panel.style.transform = "";
                if (pageRoot) {
                    pageRoot.style.willChange = "";
                    pageRoot.style.transition = "none";
                    pageRoot.style.transform = "";
                }
            }
        }, ANIM_DURATION + 50);

        floatBtn.style.opacity = "1";
        floatBtn.style.pointerEvents = "auto";
        panel.setAttribute("aria-hidden", "true");
    }

    // --- 关闭按钮 ---
    if (closeBtn) {
        closeBtn.addEventListener("click", function(e) {
            e.preventDefault();
            e.stopPropagation();
            closePanel();
        });
    }

    // --- 浮动按钮 ---
    floatBtn.addEventListener("click", function(e) {
        e.preventDefault();
        openPanel();
    });

    // --- Esc 键 ---
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && isOpen) {
            e.preventDefault();
            closePanel();
        }
    });

    // ==================== 面板触摸滑动（仅面板打开时，左滑关闭） ====================

    function onPanelTouchStart(e) {
        if (!isOpen) return;
        if (e.touches.length !== 1) return;

        // 只在面板左侧区域（手势条附近）开始触摸才响应
        const touch = e.touches[0];
        const panelRect = panel.getBoundingClientRect();
        const leftEdge = panelRect.left;
        const rightEdge = panelRect.right;
        const touchX = touch.clientX;

        // 手势条位置大约在右侧 40px
        const gestureZone = rightEdge - 60;

        // 如果触摸点在手势区域（右侧）不响应，让面板内部滚动
        if (touchX > gestureZone) return;

        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        isDragging = true;
        dragOffset = 0;

        panel.style.transition = "none";
        if (pageRoot) pageRoot.style.transition = "none";

        e.preventDefault();
    }

    function onPanelTouchMove(e) {
        if (!isDragging || !isOpen) return;

        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // 必须先判断方向（水平为主或超过阈值）
        if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 15) return;

        // 只处理左滑
        if (dx >= 0) return;

        const panelW = getPanelWidth();
        dragOffset = Math.max(-panelW, Math.min(0, dx));

        panel.style.transform = `translateX(${dragOffset}px)`;

        if (pageRoot) {
            if (isDesktop()) {
                pageRoot.style.transform = `translateX(${panelW + dragOffset}px)`;
            } else {
                pageRoot.style.transform = `translateX(calc(100% + ${dragOffset}px))`;
            }
        }

        e.preventDefault();
    }

    function onPanelTouchEnd() {
        if (!isDragging || !isOpen) return;
        isDragging = false;

        const elapsed = Date.now() - startTime;
        const velocity = elapsed > 0 ? Math.abs(dragOffset) / elapsed : 0;
        const threshold = getPanelWidth() * 0.3;

        if (dragOffset < -threshold || velocity > 0.5) {
            closePanel();
        } else {
            openPanel(true); // 弹回
        }
    }

    panel.addEventListener("touchstart", onPanelTouchStart, { passive: false });
    panel.addEventListener("touchmove", onPanelTouchMove, { passive: false });
    panel.addEventListener("touchend", onPanelTouchEnd);
    panel.addEventListener("touchcancel", onPanelTouchEnd);

    // ==================== 主页触摸滑动（右滑打开，仅面板关闭时） ====================

    function onHomeTouchStart(e) {
        // 面板打开时，主页不响应任何滑动
        if (isOpen) return;
        if (e.touches.length !== 1) return;

        // 输入框不响应滑动
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

        const touch = e.touches[0];

        // 只从屏幕左边缘开始响应右滑
        if (touch.clientX > 30) return;

        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        isDragging = true;
        dragOffset = 0;

        if (pageRoot) pageRoot.style.transition = "none";

        e.preventDefault();
    }

    function onHomeTouchMove(e) {
        if (!isDragging || isOpen) return;

        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // 必须先判断方向
        if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 15) return;

        // 只处理右滑
        if (dx <= 0) return;

        const panelW = getPanelWidth();
        const maxOffset = pageRoot ? pageRoot.offsetWidth : window.innerWidth;

        dragOffset = isDesktop()
            ? Math.min(panelW, dx)
            : Math.min(maxOffset, dx);

        if (pageRoot) {
            pageRoot.style.transform = `translateX(${dragOffset}px)`;
        }

        panel.style.transition = "none";
        const panelOffset = isDesktop()
            ? -panelW + dragOffset
            : -maxOffset + dragOffset;
        panel.style.transform = `translateX(${panelOffset}px)`;

        e.preventDefault();
    }

    function onHomeTouchEnd() {
        if (!isDragging || isOpen) return;
        isDragging = false;

        const elapsed = Date.now() - startTime;
        const velocity = elapsed > 0 ? dragOffset / elapsed : 0;
        const threshold = getPanelWidth() * 0.3;

        if (dragOffset > threshold || velocity > 0.4) {
            openPanel();
        } else {
            // 弹回关闭状态
            resetAllTransforms();
        }
    }

    if (pageRoot) {
        pageRoot.addEventListener("touchstart", onHomeTouchStart, { passive: false });
        pageRoot.addEventListener("touchmove", onHomeTouchMove, { passive: false });
        pageRoot.addEventListener("touchend", onHomeTouchEnd);
        pageRoot.addEventListener("touchcancel", onHomeTouchEnd);
    }

    // ==================== 表单提交 ====================

    if (form) {
        form.addEventListener("submit", function(e) {
            e.preventDefault();
            const nameInput = document.getElementById("feedback-name");
            const contentInput = document.getElementById("feedback-content");
            const content = contentInput ? contentInput.value.trim() : "";
            if (!content) {
                alert("请输入留言内容");
                return;
            }
            console.log("反馈提交:", {
                name: nameInput ? nameInput.value.trim() : "",
                content: content
            });
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
