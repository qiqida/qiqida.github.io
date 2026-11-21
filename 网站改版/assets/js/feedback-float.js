// ==========================
// 留言反馈面板
// 手机端：全屏滑动，左滑关闭（仅通过顶部手势区域）
// 桌面端：分屏效果
// ==========================

// ==================== 调试函数 ====================

// Debug 模式开关（通过 URL 参数 ?debug=1 开启）
const DEBUG_MODE = new URLSearchParams(window.location.search).has('debug');

// API 请求调试函数
function debugAPI(method, url, status, response, error) {
    if (!DEBUG_MODE) return;
    
    const timestamp = new Date().toISOString();
    console.group(`[API Debug] ${method} ${url}`);
    console.log('⏰ 时间:', timestamp);
    console.log('📤 请求方法:', method);
    console.log('🔗 请求地址:', url);
    console.log('📥 状态码:', status);
    
    if (error) {
        console.error('❌ 错误:', error);
    } else {
        console.log('📦 响应 JSON:', response);
    }
    
    console.groupEnd();
}

function getDebugState() {
    const pageRoot = document.getElementById("page-root");
    const feedbackPanel = document.getElementById("feedback-panel");
    return {
        window: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight
        },
        documentElement: {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth
        },
        body: {
            clientWidth: document.body.clientWidth,
            scrollWidth: document.body.scrollWidth,
            className: document.body.className,
            style: {
                position: document.body.style.position,
                width: document.body.style.width,
                height: document.body.style.height,
                overflow: document.body.style.overflow
            }
        },
        pageRoot: {
            clientWidth: pageRoot ? pageRoot.clientWidth : null,
            scrollWidth: pageRoot ? pageRoot.scrollWidth : null,
            className: pageRoot ? pageRoot.className : null,
            style: pageRoot ? {
                transform: pageRoot.style.transform,
                position: pageRoot.style.position,
                width: pageRoot.style.width,
                overflow: pageRoot.style.overflow
            } : null
        },
        feedbackPanel: feedbackPanel ? feedbackPanel.getBoundingClientRect() : null
    };
}

function checkOverflow() {
    const vw = window.innerWidth;
    const elements = document.querySelectorAll("*");
    let result = [];
    elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 5) {
            result.push({
                tag: el.tagName,
                class: el.className,
                id: el.id,
                width: Math.round(rect.width),
                right: Math.round(rect.right)
            });
        }
    });
    console.table(result);
}

function checkPageRootSize() {
    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) {
        console.log("pageRoot not found");
        return;
    }
    const result = {
        "pageRoot": {
            offsetWidth: pageRoot.offsetWidth,
            scrollWidth: pageRoot.scrollWidth,
            clientWidth: pageRoot.clientWidth
        }
    };
    const children = pageRoot.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        result[child.tagName + (child.id ? "#" + child.id : "") + "." + child.className] = {
            offsetWidth: child.offsetWidth,
            scrollWidth: child.scrollWidth,
            clientWidth: child.clientWidth
        };
    }
    console.log("pageRoot & children sizes:", result);
}

// ==================== 全局调试监听器 ====================
(function setupDebugListeners() {
    // visualViewport 监听
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function() {
            console.log('[VisualViewport Resize]', {
                innerWidth: window.innerWidth,
                visualViewportWidth: window.visualViewport.width,
                visualViewportHeight: window.visualViewport.height,
                visualViewportScale: window.visualViewport.scale,
                visualViewportOffsetLeft: window.visualViewport.offsetLeft,
                visualViewportOffsetTop: window.visualViewport.offsetTop,
                visualViewportPageLeft: window.visualViewport.pageLeft,
                visualViewportPageTop: window.visualViewport.pageTop
            });
        });

        window.visualViewport.addEventListener('scroll', function() {
            console.log('[VisualViewport Scroll]', {
                visualViewportOffsetLeft: window.visualViewport.offsetLeft,
                visualViewportOffsetTop: window.visualViewport.offsetTop,
                visualViewportPageLeft: window.visualViewport.pageLeft,
                visualViewportPageTop: window.visualViewport.pageTop
            });
        });
    }

    // window resize 监听
    window.addEventListener('resize', function() {
        console.log('[Window Resize]', {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            documentClientWidth: document.documentElement.clientWidth
        });
    });

    // MutationObserver - 监听 body 和 pageRoot 的变化
    const observerConfig = {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class', 'style']
    };

    function createObserver(name) {
        const target = document.getElementById(name) || document.body;
        return new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes') {
                    console.log(`[${name} Mutation]`, {
                        target: mutation.target.tagName + (mutation.target.id ? '#' + mutation.target.id : '') + (mutation.target.className ? '.' + mutation.target.className : ''),
                        attributeName: mutation.attributeName,
                        oldValue: mutation.oldValue,
                        newValue: mutation.target.getAttribute(mutation.attributeName)
                    });
                }
            });
        });
    }

    // 监听 body
    const bodyObserver = createObserver('body');
    bodyObserver.observe(document.body, observerConfig);

    // 监听 pageRoot
    const pageRoot = document.getElementById("page-root");
    if (pageRoot) {
        const pageRootObserver = createObserver("page-root");
        pageRootObserver.observe(pageRoot, observerConfig);
    }

    // 监听 feedback-panel
    const feedbackPanel = document.getElementById("feedback-panel");
    if (feedbackPanel) {
        const panelObserver = createObserver("feedback-panel");
        panelObserver.observe(feedbackPanel, observerConfig);
    }

    console.log('[Debug] 监听器已设置');
})();

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
        console.log('[openExternalLink] 准备跳转（已阻止）', {
            url: url,
            state: getDebugState()
        });
        // 临时：只记录日志，不跳转
        // setTimeout(() => {
        //     window.location.href = url;
        // }, 50);
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

        console.log('[openPanel] 打开前', getDebugState());

        panel.classList.add("is-open");
        if (pageRoot) pageRoot.classList.add("feedback-open");

        floatBtn.style.opacity = "0";
        floatBtn.style.pointerEvents = "none";
        panel.setAttribute("aria-hidden", "false");

        console.log('[openPanel] 打开后', getDebugState());
    }

    // 关闭面板 - 带动画效果
    function closePanel() {
        if (!isOpen) return;
        isOpen = false;

        console.log('[closePanel] 关闭前', getDebugState());

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

            console.log('[closePanel] 清理后', getDebugState());
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
            console.log('[Survey Link] 点击前', getDebugState());

            e.preventDefault();
            e.stopPropagation();

            const url = this.getAttribute("href");
            console.log('[Survey Link] href:', url);

            openExternalLink(url);

            // 延迟后再次检查状态
            setTimeout(() => {
                console.log('[Survey Link] 200ms后', getDebugState());
                checkOverflow();
            }, 200);
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

    async function submitFeedback() {
        const nameInput = form.querySelector('#feedback-name');
        const contentInput = form.querySelector('#feedback-content');
        const submitBtn = form.querySelector('.feedback-submit-btn');
        const charCount = form.querySelector('.char-count');
        
        const name = nameInput?.value?.trim() || '';
        const content = contentInput?.value?.trim() || '';

        // 验证必填项
        if (!content) {
            showToast('请输入留言内容');
            contentInput?.focus();
            return;
        }

        // 字数超限检查
        if (content.length > 500) {
            showToast('留言内容不能超过500字');
            contentInput?.focus();
            return;
        }

        // 禁用按钮，显示加载状态
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';
        }

        try {
            const apiUrl = 'https://qiqida-stats-worker.dddhui-qi.workers.dev/api/feedback';
            console.log('[Feedback] 提交留言请求:', { name, content, url: apiUrl });
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, content })
            });

            const result = await response.json();
            debugAPI('POST', apiUrl, response.status, result);

            if (result.success) {
                showToast('留言提交成功');
                // 清空表单（保留当前抽屉不关闭）
                if (nameInput) nameInput.value = '';
                if (contentInput) contentInput.value = '';
                if (charCount) charCount.textContent = '0/500';
            } else {
                showToast(result.error || '提交失败');
            }
        } catch (error) {
            debugAPI('POST', 'https://qiqida-stats-worker.dddhui-qi.workers.dev/api/feedback', null, null, error);
            console.error('留言提交失败:', error);
            showToast('网络错误，请稍后重试');
        } finally {
            // 恢复按钮状态
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '提交留言';
            }
        }
    }

    if (form) {
        const submitBtn = form.querySelector('.feedback-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                submitFeedback();
            });
        }
    }

    // ==================== 字数统计 ====================

    function setupCharCount() {
        const contentInput = form.querySelector('#feedback-content');
        const charCount = form.querySelector('.char-count');
        
        if (!contentInput || !charCount) return;

        function updateCharCount() {
            const length = contentInput.value.length;
            charCount.textContent = `${length}/500`;
            
            if (length > 500) {
                charCount.classList.add('over-limit');
            } else {
                charCount.classList.remove('over-limit');
            }
        }

        contentInput.addEventListener('input', updateCharCount);
        updateCharCount();
    }

    // ==================== 移动端 input focus 处理 ====================

    function setupInputFocusHandling() {
        const formInputs = panel.querySelectorAll('input, textarea');
        formInputs.forEach(input => {
            // focus 时记录 viewport 状态
            input.addEventListener('focus', function() {
                if (!isMobile()) return;

                console.log('[Focus In]', {
                    innerWidth: window.innerWidth,
                    visualViewportWidth: window.visualViewport?.width,
                    visualViewportScale: window.visualViewport?.scale
                });
            });

            // blur 时记录 viewport 状态
            input.addEventListener('blur', function() {
                if (!isMobile()) return;

                console.log('[Focus Out]', {
                    innerWidth: window.innerWidth,
                    visualViewportWidth: window.visualViewport?.width,
                    visualViewportScale: window.visualViewport?.scale
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
        // 设置字数统计
        setupCharCount();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFeedbackFloat);
} else {
    initFeedbackFloat();
}
