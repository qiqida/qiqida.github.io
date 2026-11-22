// ==========================
// header-height.js
// --------------------------
// 实测「吸顶头部」的真实高度，写回 CSS 变量 --nav-h / --searchbar-h。
//
// 为什么需要这个
//
// 吸顶头部由两层组成：
//   .navbar          导航栏
//   搜索条            .desktop-search 或 .mobile-search
//
// 这两层的高度会变：
//   · 导航栏高度随内容、字体加载完成、用户放大字体而变
//   · 桌面端 66px、移动端 60px（padding 不同）
//   · 子页面 navbar 还多一个「返回首页」按钮，更高
//
// 而 hero（首屏）的顶部留白要正好等于「吸顶头部总高」，
// 否则内容会被吸顶层盖住，或者留白过大。
//
// 用 JS 实测比在 CSS 里写死数值可靠：
// 写死的值会在「用户放大字体」「字体回退到别的字体」
// 「标题换行」这些情况下失效。
//
// 兼容性
//   · 没有 ResizeObserver 的老浏览器 → 降级到 window resize 事件
//   · 脚本没加载 → CSS 里 :root 的默认值兜底
// ==========================

(function () {
    "use strict";

    const root = document.documentElement;

    // 吸顶头部容器
    const stack = document.querySelector(".header-stack");

    if (!stack) return;   // 子页面暂时没有 .header-stack，直接跳过

    const navbar = stack.querySelector(".navbar");
    const desktopSearch = stack.querySelector(".desktop-search");
    const mobileSearch = stack.querySelector(".mobile-search");

    // 上一次写入的值，避免重复写 CSS 变量触发无谓的重排
    let lastNav = -1;
    let lastSearch = -1;

    function measure() {
        const navH = navbar ? navbar.offsetHeight : 0;

        // 搜索条：桌面端和移动端只有一个是显示的，
        // offsetHeight 对 display:none 的元素返回 0，
        // 所以直接取两者的最大值即可，不用判断断点。
        const dH = desktopSearch ? desktopSearch.offsetHeight : 0;
        const mH = mobileSearch ? mobileSearch.offsetHeight : 0;
        const searchH = Math.max(dH, mH);

        if (navH !== lastNav) {
            root.style.setProperty("--nav-h", navH + "px");
            lastNav = navH;
        }
        if (searchH !== lastSearch) {
            root.style.setProperty("--searchbar-h", searchH + "px");
            lastSearch = searchH;
        }
    }

    // 初次测量
    measure();

    // 字体加载完成后高度会变（字体替换导致行高变化）
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(measure).catch(function () { });
    }

    // 窗口尺寸变化（断点切换、旋转屏幕、缩放）
    window.addEventListener("resize", measure);

    // 内容变化（navbar 里的文字换行等）
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(measure);
        ro.observe(stack);
        if (navbar) ro.observe(navbar);
        if (desktopSearch) ro.observe(desktopSearch);
        if (mobileSearch) ro.observe(mobileSearch);
    }

    // 深色模式切换不影响高度，但保险起见也测一次
    if (window.themeObserver) {
        // 预留：主题系统若提供变更钩子，这里可以挂上去
    }
})();
