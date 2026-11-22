// 主题持久化 + 回到顶部按钮（全站共用）
//
// 主题切换按钮从「emoji 按钮」改成了「弹性开关」。
// 这个文件负责状态，动画全部交给 CSS：
//   · JS 只改 html[data-theme] 和 aria-checked
//   · CSS 根据 html[data-theme="dark"] 选择器决定轨道宽度、
//     滑块位置、图标显隐
//
// 为什么 JS 不直接控制动画：
//   这样切换逻辑只有一份真相（html 上的 data-theme），
//   首屏 theme-init.js 提前设好属性后，CSS 自动就是对的，
//   不会出现「JS 还没跑完，开关显示错位」的闪烁。
//
// 拉伸时序：
//   点击 → 轨道先横向拉伸（胶囊形）
//        → 滑块同时滑向另一端
//        → 到达终点，宽度收回，轻微回弹
//   CSS 用同一条回弹曲线控制 width 和 transform，
//   两者天然同步，不需要 JS 编排。

const THEME_KEY = "gsh-theme";

// 切换时给开关加一个 .is-animating，
// 用来触发「滑块横向撑开成胶囊」的弹性效果。
// 动画结束后移除，避免和 hover 等状态叠加。
function pulseSwitch(toggleBtn) {
    if (!toggleBtn) return;

    toggleBtn.classList.remove("is-animating");
    // 强制重排，确保连续点击时动画能重新播放
    void toggleBtn.offsetWidth;
    toggleBtn.classList.add("is-animating");

    clearTimeout(pulseSwitch._timer);
    pulseSwitch._timer = setTimeout(function () {
        toggleBtn.classList.remove("is-animating");
    }, 460);
}

function applyTheme(theme) {
    const toggleBtn = document.getElementById("theme-toggle");

    if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        // 开关类控件用 aria-checked 表达状态，比换 aria-label 文本更准确
        if (toggleBtn) toggleBtn.setAttribute("aria-checked", "true");
    } else {
        document.documentElement.removeAttribute("data-theme");
        if (toggleBtn) toggleBtn.setAttribute("aria-checked", "false");
    }

    // 通知页面：mermaid 流程图等需要跟随主题重新渲染
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}

function toggleTheme() {
    const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";

    if (next === "dark") {
        localStorage.setItem(THEME_KEY, "dark");
    } else {
        localStorage.removeItem(THEME_KEY);
    }

    applyTheme(next);

    // 触发弹性胶囊效果
    pulseSwitch(document.getElementById("theme-toggle"));
}

function initTheme() {
    applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");

    const toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", toggleTheme);
    }
}

function initBackToTop() {
    const btn = document.createElement("button");
    btn.id = "back-to-top";
    btn.className = "back-to-top";
    btn.setAttribute("aria-label", "回到顶部");
    btn.textContent = "↑";
    btn.hidden = true;

    btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.body.appendChild(btn);

    window.addEventListener("scroll", () => {
        btn.hidden = window.scrollY < 300;
    });
}

initTheme();
initBackToTop();
