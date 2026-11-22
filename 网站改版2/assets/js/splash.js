// ==========================
// splash.js —— 品牌引导页
// --------------------------
// 进首页先看一屏品牌页，往下滑 / 点指示器 / 按空格
// 就进入内容区。
//
// 这里是「弱劫持」：
//   · 只吃掉「第一次向下的滚动」
//   · 之后就完全自由，浏览器原生滚动一行都不拦
//
// 为什么用弱劫持而不是全权接管：
//   全权接管（自己算滚动位置、自己写 transform）会：
//     1. 破坏移动端惯性和下拉刷新
//     2. 和吸顶导航（position: sticky）打架
//     3. 让「跳到正文」这类无障碍跳转失效
//   弱劫持只做一次转场，之后交还给浏览器，问题全无。
//
// 实现要点：
//   引导页是 position:fixed 的覆盖层，不占文档流。
//   所以转场只是「覆盖层上滑退出」，不需要补偿滚动量，
//   内容区从头到尾都不会跳动。
//
// 减弱动效偏好（prefers-reduced-motion: reduce）：
//   不播转场动画，直接露出内容区。
// ==========================

(function () {
    "use strict";

    const splash = document.getElementById("splash");
    if (!splash) return;   // 子页面没有引导页

    const hint = splash.querySelector(".scroll-hint");

    // 用户系统里开了「减弱动态效果」吗
    const reduceMotion = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 三种状态：
    //   locked  —— 还在引导页，第一次向下滚会被吃掉
    //   leaving —— 正在转场，忽略所有输入
    //   done    —— 已进入内容区，完全自由
    let state = "locked";

    // ---------- 核心：进入内容区 ----------
    function enterContent() {
        if (state !== "locked") return;
        state = "leaving";

        splash.classList.add("is-leaving");
        document.body.classList.remove("has-splash");

        // 引导页是 fixed 覆盖层，不占文档流。
        // 所以这里什么都不用滚 —— 内容区本来就在它下面，
        // 覆盖层一退开就自然露出来了。
        //
        // （不传参数 scrollTo，是为了不打断用户自己的滚动位置）
        if (reduceMotion) {
            splash.classList.add("is-hidden");
            state = "done";
            return;
        }

        // 转场动画走完（transform 0.65s）后彻底移除
        setTimeout(function () {
            splash.classList.add("is-hidden");
            state = "done";
        }, 700);
    }

    // ---------- 滚轮：吃掉第一次向下滚 ----------
    window.addEventListener("wheel", function (e) {
        if (state !== "locked") return;

        // 只处理向下滚
        if (e.deltaY <= 0) return;

        // 吃掉这一次 —— 让它触发转场，而不是直接滚走
        e.preventDefault();
        enterContent();
    }, { passive: false });

    // ---------- 触摸：手指上滑 = 想看下面 ----------
    let touchStartY = 0;
    let touchOnSplash = false;

    window.addEventListener("touchstart", function (e) {
        if (state !== "locked") return;

        touchStartY = e.touches[0].clientY;

        // 只在触摸发生在引导页范围内时才准备拦截。
        // 触摸导航栏 / 搜索框时不拦截，否则会影响输入。
        touchOnSplash = splash.contains(e.target);
    }, { passive: true });

    window.addEventListener("touchmove", function (e) {
        if (state !== "locked") return;
        if (!touchOnSplash) return;

        // 手指往上滑超过 30px，认定为「想进入内容区」
        if (touchStartY - e.touches[0].clientY > 30) {
            e.preventDefault();
            enterContent();
        }
    }, { passive: false });

    // ---------- 触摸结束，重置标记 ----------
    window.addEventListener("touchend", function () {
        touchOnSplash = false;
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
            if (state === "locked") {
                splash.classList.add("is-hidden");
                document.body.classList.remove("has-splash");
                state = "done";
            }
        });
    });
})();
