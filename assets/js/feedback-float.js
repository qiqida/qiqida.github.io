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

    const ANIM_DURATION = 350;

    let isOpen = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let dragOffset = 0;
    let startTime = 0;
    let hasMoved = false;

    function isDesktop() {
        return window.innerWidth > 768;
    }

    function getPanelWidth() {
        return Math.min(380, window.innerWidth * (isDesktop() ? 0.9 : 1));
    }

    // 打开面板
    function openPanel() {
        if (isOpen) return;
        isOpen = true;

        panel.classList.add("is-open");
        if (pageRoot) pageRoot.classList.add("feedback-open");

        floatBtn.style.opacity = "0";
        floatBtn.style.pointerEvents = "none";
        panel.setAttribute("aria-hidden", "false");
    }

    // 关闭面板 - 带动画效果
    function closePanel() {
        if (!isOpen) return;
        isOpen = false;

        // 先设置 inline transform 作为起点，然后设置 transition，最后触发动画
        panel.style.transform = "translateX(0)";
        panel.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;

        if (pageRoot) {
            const panelW = getPanelWidth();
            if (isDesktop()) {
                pageRoot.style.transform = `translateX(${panelW}px)`;
            } else {
                pageRoot.style.transform = "translateX(100%)";
            }
            pageRoot.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        }

        // 触发动画
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                panel.style.transform = "translateX(-100%)";
                if (pageRoot) {
                    pageRoot.style.transform = "translateX(0)";
                }
            });
        });

        // 动画结束后清理
        setTimeout(() => {
            panel.classList.remove("is-open");
            if (pageRoot) pageRoot.classList.remove("feedback-open");
            panel.style.transform = "";
            panel.style.transition = "";
            if (pageRoot) {
                pageRoot.style.transform = "";
                pageRoot.style.transition = "";
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

    // ==================== 面板触摸滑动（左滑关闭） ====================

    // 判断触摸点是否在表单元素上
    function isTouchOnFormElement(touch) {
        const nameInput = document.getElementById("feedback-name");
        const contentInput = document.getElementById("feedback-content");
        const submitBtn = panel.querySelector(".feedback-submit");

        const formElements = [nameInput, contentInput, submitBtn];
        for (const el of formElements) {
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            // 检查触摸点是否在元素范围内
            if (rect.width > 0 && rect.height > 0 &&
                touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                return true;
            }
        }
        return false;
    }

    function onPanelTouchStart(e) {
        if (!isOpen) return;
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];

        // 如果触摸在表单元素上，不拦截，让表单正常响应
        if (isTouchOnFormElement(touch)) {
            return;
        }

        // 记录起始位置
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        isDragging = true;
        dragOffset = 0;
        hasMoved = false;

        // 临时移除 class，用 inline style 控制
        panel.classList.remove("is-open");
        panel.style.transition = "none";
        if (pageRoot) {
            pageRoot.classList.remove("feedback-open");
            pageRoot.style.transition = "none";
        }

        e.preventDefault();
    }

    function onPanelTouchMove(e) {
        if (!isDragging || !isOpen) return;

        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // 如果还没有移动过，先判断方向
        if (!hasMoved) {
            // 优先垂直滚动时不拦截
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 20) return;
            hasMoved = true;
        }

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

        // 只有真正发生了左滑（移动距离超过 10px）才关闭
        if (!hasMoved || dragOffset >= -10) {
            // 没有滑动，弹回打开状态
            panel.style.transform = "";
            panel.style.transition = "";
            if (pageRoot) {
                pageRoot.style.transform = "";
                pageRoot.style.transition = "";
            }
            panel.classList.add("is-open");
            if (pageRoot) pageRoot.classList.add("feedback-open");
            return;
        }

        const elapsed = Date.now() - startTime;
        const velocity = elapsed > 0 ? Math.abs(dragOffset) / elapsed : 0;
        const threshold = getPanelWidth() * 0.25;

        if (dragOffset < -threshold || velocity > 0.4) {
            // 左滑关闭
            closePanel();
        } else {
            // 弹回打开状态
            panel.style.transform = "";
            panel.style.transition = "";
            if (pageRoot) {
                pageRoot.style.transform = "";
                pageRoot.style.transition = "";
            }
            panel.classList.add("is-open");
            if (pageRoot) pageRoot.classList.add("feedback-open");
        }
    }

    panel.addEventListener("touchstart", onPanelTouchStart, { passive: false });
    panel.addEventListener("touchmove", onPanelTouchMove, { passive: false });
    panel.addEventListener("touchend", onPanelTouchEnd);
    panel.addEventListener("touchcancel", onPanelTouchEnd);

    // ==================== 主页触摸滑动（右滑打开，仅面板关闭时） ====================

    function onHomeTouchStart(e) {
        if (isOpen) return;
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];

        // 输入框不响应滑动
        if (touch.target.tagName === "INPUT" || touch.target.tagName === "TEXTAREA") return;

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

        // 优先垂直滚动时不拦截
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) return;

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
            panel.style.transform = "";
            panel.style.transition = "";
            if (pageRoot) {
                pageRoot.style.transform = "";
                pageRoot.style.transition = "";
            }
            openPanel();
        } else {
            panel.style.transform = "";
            panel.style.transition = "";
            if (pageRoot) {
                pageRoot.style.transform = "";
                pageRoot.style.transition = "";
            }
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
