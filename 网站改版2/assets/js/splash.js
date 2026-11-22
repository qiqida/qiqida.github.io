// ==========================
// splash.js —— 品牌引导页
// --------------------------
// 进首页先看一屏品牌页，往下滑就进入内容区。
//
// 这里是「弱劫持 + 跟手拖拽」：
//   · 只接管「第一次向下的滚动」
//   · 拖拽过程中引导页实时跟着手指/滚轮移动（跟手）
//   · 一旦松手并完成转场，之后完全交还浏览器，滚动一行都不拦
//
// 为什么用弱劫持而不是全权接管：
//   全权接管（自己算滚动位置、自己写 transform）会：
//     1. 破坏移动端惯性和下拉刷新
//     2. 和吸顶导航（position: sticky）打架
//     3. 让「跳到正文」这类无障碍跳转失效
//   弱劫持只做一次转场，之后交还给浏览器，问题全无。
//
// 为什么不做成「自动播完的动画」：
//   自动动画不管你划多轻都是完整播一遍，轻划和死划效果一样，
//   显得「用力过猛」。跟手拖拽让力度和位移真实挂钩，
//   轻轻一划就是轻轻滑过去。
//
// 实现要点：
//   引导页是 position:fixed 的覆盖层，不占文档流。
//   所以转场只是「覆盖层移开」，不需要补偿滚动量，
//   内容区从头到尾都不会跳动。
//
// 减弱动效偏好（prefers-reduced-motion: reduce）：
//   不做拖拽跟随，也不播转场动画，直接露出内容区。
// ==========================

(function () {
    "use strict";

    const splash = document.getElementById("splash");
    if (!splash) return;   // 子页面没有引导页

    const hint = splash.querySelector(".scroll-hint");

    // 用户系统里开了「减弱动态效果」吗
    const reduceMotion = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 转场完成的阈值：拖过这么多比例就进入内容区。
    // 45% 屏高 —— 之前 25% 太容易进，轻轻一划就过了。
    // 现在要划过大半屏才算「明确要进内容区」。
    const COMMIT_RATIO = 0.45;
    // 回弹的阻尼系数：松手时残留多少速度继续滑
    const FLICK_RATIO = 0.45;    // 甩得够快就直接进，不看位移

    // 状态机：
    //   locked  —— 还在引导页，等待第一次向下拖
    //   dragging—— 正在跟手拖拽中
    //   leaving —— 松手后正在做收尾动画
    //   done    —— 已进入内容区，完全自由
    let state = "locked";

    // 转场期间是否要「吞掉」残余手势。
    //
    // 问题：手指划到位松手 → 触发转场 → 但手指可能还在继续往上滑，
    //       这几帧的 touchmove 事件如果不管，浏览器就会拿去滚内容页，
    //       表现为「滑进引导页后，内容页也跟着滑了一下」。
    //
    // 解法：只要「转场中」或者「手指还按在屏幕上」，
    //       就把 touchmove 吃掉，内容页一动不动。
    //       等手指真正抬起（touchend）之后，才彻底交还给浏览器。
    function swallowGesture(e) {
        // 只在引导页还活着时才拦截手势。
        //
        // 一旦进入内容区（state === "done"），
        // 必须彻底放行，否则内容页就滑不动了。
        if (state === "done") return;

        // 转场中，或手指还没抬起 → 吞掉，别让内容页跟着滑
        if (state === "leaving" || touchActive) {
            // preventDefault 对不可取消的事件是无害的空操作，
            // 所以不用先判断 cancelable。
            if (typeof e.preventDefault === "function") e.preventDefault();
        }
    }

    // 当前拖拽位移（px，正数表示向上滑）
    let offset = 0;
    // 拖拽起点
    let startY = 0;
    // 上一次手势的位置，用于算速度
    let lastY = 0;
    let lastTime = 0;
    // 手势速度（px/ms），正数表示向上
    let velocity = 0;
    // 本次手势是否被认定为「有效向下拖」
    let dragging = false;
    // 手指是否还按在屏幕上。
    // 转场动画播完后，如果手指还没抬起，继续吞掉手势，
    // 否则内容页会被残余滑动带着跑。
    let touchActive = false;

    // 引导页的可视高度（导航下方到屏幕底部）
    let viewH = splash.offsetHeight || window.innerHeight;

    function measure() {
        viewH = splash.offsetHeight || window.innerHeight;
    }

    // ---------- 设置拖拽位移 ----------
    function setOffset(v) {
        offset = Math.max(0, Math.min(v, viewH));
        // 拖到哪儿就显示到哪儿
        splash.style.transform = "translate3d(0, -" + offset + "px, 0)";
    }

    // ---------- 释放拖拽状态 ----------
    function clearDragState() {
        dragging = false;
        splash.classList.remove("is-dragging");
    }

    // ---------- 核心：完成转场，进入内容区 ----------
    function enterContent() {
        if (state === "done" || state === "leaving") return;
        state = "leaving";
        clearDragState();

        document.body.classList.remove("has-splash");

        if (reduceMotion) {
            splash.classList.add("is-hidden");
            touchActive = false;
            state = "done";
            return;
        }

        // 收尾：把剩余距离补完。
        // 时长压到 0.3s、缓动用 ease-out（前快后慢，不回弹），
        // 避免最后那一段又「冲」一下。
        splash.classList.add("is-leaving");
        splash.style.transform = "";

        setTimeout(function () {
            splash.classList.add("is-hidden");
            // 兜底清掉 touchActive。
            // 正常情况下 touchend 会把它置回 false，
            // 但如果那次抬手事件没送达（比如被系统手势接管），
            // 它会一直卡在 true，导致内容页永久滑不动。
            touchActive = false;
            state = "done";
        }, 340);
    }

    // ---------- 回弹：松手但没到阈值 ----------
    function springBack() {
        state = "leaving";
        clearDragState();

        if (reduceMotion) {
            splash.classList.add("is-hidden");
            touchActive = false;
            state = "done";
            return;
        }

        // 加一个 class 触发动画，动画结束后清理
        splash.classList.add("is-springing");
        splash.style.transform = "";

        const onEnd = function () {
            splash.classList.remove("is-springing");
            splash.removeEventListener("transitionend", onEnd);
            // 回弹后引导页还在，手势可以重新开始。
            // 这里清一下，避免上一次手势的残留状态。
            touchActive = false;
            state = "locked";
        };
        splash.addEventListener("transitionend", onEnd);

        // 兜底：transitionend 在某些情况下不触发
        setTimeout(function () {
            if (splash.classList.contains("is-springing")) onEnd();
        }, 500);
    }

    // ---------- 触摸：跟手拖拽 ----------
    window.addEventListener("touchstart", function (e) {
        // 只有「引导页还活着」时，才需要记录 touchActive。
        //
        // touchActive 的用途是：手指在引导页上按下后拖动触发了转场，
        // 但手指还没抬起时，要继续吞掉残余手势，别让内容页跟着滑。
        // 这种情况下 state 是 locked（按下那一刻）。
        //
        // 转场期间（state === "leaving"）的拦截由 state 本身负责，
        // 不需要 touchActive 参与。所以这里只在 locked 时置位，
        // 否则转场中的新触摸会被误标记，转场结束后新手势还被吞，
        // 表现就是「内容页第一下滑不动」。
        if (state !== "locked") return;

        // 只在触摸发生在引导页范围内时才准备拦截。
        // 触摸导航栏 / 搜索框时不拦截，否则会影响输入。
        if (!splash.contains(e.target)) return;

        touchActive = true;
        startY = e.touches[0].clientY;
        lastY = startY;
        lastTime = Date.now();
        velocity = 0;
        dragging = false;
    }, { passive: true });

    window.addEventListener("touchmove", function (e) {
        // 注意：这里必须同时允许 "dragging"。
        // 第一次 touchmove 之后 state 会变成 "dragging"，
        // 如果守卫只认 "locked"，后续手势就全被丢掉了，
        // 引导页只跟了第一帧就卡住不动。
        if (state !== "locked" && state !== "dragging") {
            // 转场中：吞掉残余手势，别让内容页跟着滑
            swallowGesture(e);
            return;
        }
        if (!splash.contains(e.target)) return;

        const y = e.touches[0].clientY;
        const delta = startY - y;   // 正数 = 手指上滑

        // 还没开始拖（位移太小，方向可能是错的）
        if (!dragging) {
            // 明显向上才认定为拖拽；向下则完全不理会
            if (delta < 8) return;
            dragging = true;
            state = "dragging";
            splash.classList.add("is-dragging");
        }

        // 接管手势，阻止页面跟着一起滚
        e.preventDefault();

        // 跟手：位移直接映射到引导页位移
        setOffset(delta);

        // 算速度（做一点平滑，避免抖动）
        const now = Date.now();
        const dt = now - lastTime;
        if (dt > 0) {
            const v = (lastY - y) / dt;
            velocity = velocity * 0.7 + v * 0.3;
        }
        lastY = y;
        lastTime = now;
    }, { passive: false });

    // ---------- 触摸结束：决定完成还是回弹 ----------
    window.addEventListener("touchend", function () {
        touchActive = false;

        if (state !== "dragging") return;

        const moved = offset;
        const flicked = velocity > FLICK_RATIO;   // 甩得够快

        // 甩得够快直接进；否则看位移是否过阈值
        if (flicked || moved > viewH * COMMIT_RATIO) {
            enterContent();
        } else {
            springBack();
        }
    }, { passive: true });

    window.addEventListener("touchcancel", function () {
        touchActive = false;
        if (state === "dragging") springBack();
    }, { passive: true });

    // ---------- 滚轮：跟手跟随 ----------
    // 桌面上没有「手指」，用滚轮增量模拟位移。
    // 累计到一定量就完成转场，这样滚轮也有一致的节奏感。
    window.addEventListener("wheel", function (e) {
        if (state !== "locked" && state !== "dragging") {
            // 转场中：吞掉残余滚轮，别让内容页跟着滚
            swallowGesture(e);
            return;
        }

        // 只处理向下滚
        if (e.deltaY <= 0) return;

        e.preventDefault();

        if (state === "locked") {
            state = "dragging";
            splash.classList.add("is-dragging");
        }

        // 滚轮增量直接映射到位移。
        // 乘 1.6 是为了让滚动手感和手指拖拽接近 ——
        // 滚轮一格通常只有 100px 左右，直接用会显得很慢。
        setOffset(offset + e.deltaY * 1.6);

        if (offset > viewH * COMMIT_RATIO) {
            enterContent();
        }
    }, { passive: false });

    // 滚轮停下来后如果没到阈值，回弹
    let wheelTimer = null;
    window.addEventListener("wheel", function () {
        if (wheelTimer) clearTimeout(wheelTimer);
        wheelTimer = setTimeout(function () {
            if (state === "dragging" && offset <= viewH * COMMIT_RATIO) {
                springBack();
            }
        }, 140);
    }, { passive: true });

    // ---------- 点击指示器 ----------
    if (hint) {
        hint.addEventListener("click", function (e) {
            e.preventDefault();
            enterContent();
        });
    }

    // ---------- 键盘：空格 / PageDown / 方向下 ----------
    window.addEventListener("keydown", function (e) {
        if (state !== "locked") return;

        // 用户正在输入框里打字时不要抢键盘
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
            return;
        }

        if (e.key === "PageDown" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            enterContent();
        }
    });

    // ---------- 无障碍：「跳到正文」直接进内容区 ----------
    // 引导页在 #main-content 前面，不处理的话
    // 键盘用户点了「跳到正文」会先滚到引导页，等于没跳。
    document.querySelectorAll(".skip-to-content").forEach(function (link) {
        link.addEventListener("click", function () {
            if (state === "locked" || state === "dragging") {
                splash.classList.add("is-hidden");
                document.body.classList.remove("has-splash");
                touchActive = false;
                state = "done";
            }
        });
    });

    // ---------- 尺寸变化时重新测量 ----------
    window.addEventListener("resize", measure);
    measure();
    // 字体加载完成后高度会变，再测一次
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(measure).catch(function () { });
    }
})();
