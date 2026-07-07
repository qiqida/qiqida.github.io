// ==========================
// 留言反馈面板
// 手机端：全屏滑动，左滑关闭（仅通过顶部手势区域）
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
    const SWIPE_THRESHOLD = 80; // 水平滑动必须超过80px才能关闭

    let isOpen = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let dragOffset = 0;
    let startTime = 0;

    // ==================== 辅助函数：判断触摸目标是否为表单元素 ====================
    function isFormElement(target) {
        const tagName = target.tagName;
        if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'].includes(tagName)) {
            return true;
        }
        // 检查是否在表单元素内部
        const formElements = panel.querySelectorAll('input, textarea, button, select, a');
        for (const el of formElements) {
            if (el === target || el.contains(target)) {
                return true;
            }
        }
        return false;
    }

    // ==================== 辅助函数：打开外部链接前清理状态 ====================
    function openExternalLink(url) {
        // 先清理 body 状态
        document.body.classList.remove("feedback-open");
        document.body.style.position = "";
        document.body.style.height = "";
        document.body.style.overflow = "";
        document.body.style.width = "";

        // 清理 panel 状态
        panel.classList.remove("is-open");
        panel.style.transform = "";
        panel.style.transition = "";

        // 清理 pageRoot 状态
        if (pageRoot) {
            pageRoot.classList.remove("feedback-open");
            pageRoot.style.transform = "";
            pageRoot.style.transition = "";
        }

        // 重置状态变量
        isOpen = false;
        isDragging = false;

        // 恢复浮动按钮
        floatBtn.style.opacity = "1";
        floatBtn.style.pointerEvents = "auto";

        // 延迟跳转，等待状态清理完成
        setTimeout(() => {
            window.location.href = url;
        }, 50);
    }

    // ==================== 辅助函数：显示Toast提示 ====================
    function showToast(message) {
        // 移除已存在的toast
        const existingToast = document.querySelector('.feedback-toast');
        if (existingToast) {
            existingToast.remove();
        }

        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = 'feedback-toast';
        toast.textContent = message;
        panel.appendChild(toast);

        // 触发显示动画
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });

        // 2秒后隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 2000);
    }

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

    // --- 问卷星链接（移动端使用JS跳转） ---
    const surveyLink = document.getElementById("survey-link");
    if (surveyLink) {
        surveyLink.addEventListener("click", function(e) {
            e.preventDefault();
            e.stopPropagation();
            const url = this.getAttribute("href");
            openExternalLink(url);
        });
    }

    // --- Esc 键 ---
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && isOpen) {
            e.preventDefault();
            closePanel();
        }
    });

    // ==================== 面板手势滑动（左滑关闭 - 移动端） ====================

    // 移动端滑动阈值：屏幕宽度的30%
    function getSwipeThreshold() {
        return window.innerWidth * 0.3;
    }

    function onPanelSwipeStart(e) {
        if (!isOpen) return;
        if (e.touches.length !== 1) return;

        // 如果触摸目标是表单元素，不处理滑动
        if (isFormElement(e.target)) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        currentX = touch.clientX;
        currentY = touch.clientY;
        startTime = Date.now();
        isDragging = true;

        // 临时禁用过渡效果
        panel.style.transition = "none";
        if (pageRoot) {
            pageRoot.style.transition = "none";
        }

        e.preventDefault();
    }

    function onPanelSwipeMove(e) {
        if (!isDragging || !isOpen) return;

        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        currentX = touch.clientX;
        currentY = touch.clientY;

        // 只处理左滑
        if (dx >= 0) return;

        // 必须以水平移动为主
        if (Math.abs(dy) >= Math.abs(dx)) return;

        // 面板跟随手指移动
        panel.style.transform = `translateX(${dx}px)`;

        // 主页跟随移动（移动端）
        if (pageRoot && !isDesktop()) {
            const panelW = window.innerWidth;
            pageRoot.style.transform = `translateX(calc(100% + ${dx}px))`;
        }

        e.preventDefault();
    }

    function onPanelSwipeEnd(e) {
        if (!isDragging || !isOpen) return;
        isDragging = false;

        const dx = currentX - startX; // 负数表示左滑
        const dy = Math.abs(currentY - startY);
        const totalMoveX = Math.abs(dx);

        // 判断是否为点击（移动距离很小）
        const isClick = totalMoveX < 10 && dy < 10;

        // 恢复过渡效果
        panel.style.transition = "";
        if (pageRoot) {
            pageRoot.style.transition = "";
        }

        // 点击不触发关闭，恢复原位
        if (isClick) {
            panel.style.transform = "";
            if (pageRoot) {
                pageRoot.style.transform = "";
            }
            return;
        }

        // 关闭阈值：超过屏幕宽度30%
        const threshold = getSwipeThreshold();

        if (totalMoveX > threshold) {
            // 超过阈值，关闭面板
            closePanel();
        } else {
            // 未超过阈值，恢复原位
            panel.style.transform = "";
            if (pageRoot) {
                pageRoot.style.transform = "";
            }
        }
    }

    // 绑定到整个面板
    panel.addEventListener("touchstart", onPanelSwipeStart, { passive: false });
    panel.addEventListener("touchmove", onPanelSwipeMove, { passive: false });
    panel.addEventListener("touchend", onPanelSwipeEnd);
    panel.addEventListener("touchcancel", onPanelSwipeEnd);

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
        // 监听提交按钮点击
        const submitBtn = form.querySelector('.feedback-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const nameInput = document.getElementById("feedback-name");
                const contentInput = document.getElementById("feedback-content");
                const content = contentInput ? contentInput.value.trim() : "";
                if (!content) {
                    showToast("请输入留言内容");
                    return;
                }
                console.log("反馈提交:", {
                    name: nameInput ? nameInput.value.trim() : "",
                    content: content
                });
                showToast("感谢您的反馈！（演示模式）");
                form.reset();
                // 不关闭面板，保持在反馈页面
            });
        }
    }

    // ==================== 移动端 input focus 处理 ====================

    function setupInputFocusHandling() {
        const formInputs = panel.querySelectorAll('input, textarea');
        formInputs.forEach(input => {
            // focus 时记录 viewport 状态
            input.addEventListener('focus', function() {
                if (!isMobile()) return;

                // 调试日志
                console.log('[Focus In]', {
                    innerWidth: window.innerWidth,
                    visualViewportWidth: window.visualViewport?.width,
                    visualViewportScale: window.visualViewport?.scale,
                    bodyPosition: document.body.style.position,
                    bodyWidth: document.body.style.width,
                    bodyHeight: document.body.style.height,
                    bodyOverflow: document.body.style.overflow
                });
            });

            // blur 时记录 viewport 状态
            input.addEventListener('blur', function() {
                if (!isMobile()) return;

                // 调试日志
                console.log('[Focus Out]', {
                    innerWidth: window.innerWidth,
                    visualViewportWidth: window.visualViewport?.width,
                    visualViewportScale: window.visualViewport?.scale,
                    bodyPosition: document.body.style.position,
                    bodyWidth: document.body.style.width,
                    bodyHeight: document.body.style.height,
                    bodyOverflow: document.body.style.overflow
                });
            });
        });
    }

    // 辅助函数：判断是否为移动端
    function isMobile() {
        return window.innerWidth <= 768;
    }

    // 在打开面板时设置 input focus 处理
    function openPanel() {
        if (isOpen) return;
        isOpen = true;

        panel.classList.add("is-open");
        if (pageRoot) pageRoot.classList.add("feedback-open");

        floatBtn.style.opacity = "0";
        floatBtn.style.pointerEvents = "none";
        panel.setAttribute("aria-hidden", "false");

        // 设置 input focus 处理
        setupInputFocusHandling();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFeedbackFloat);
} else {
    initFeedbackFloat();
}
