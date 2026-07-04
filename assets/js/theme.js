// 主题持久化 + 回到顶部按钮（全站共用）

const THEME_KEY = "gsh-theme";

function applyTheme(theme) {
    const toggleBtn = document.getElementById("theme-toggle");

    if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        if (toggleBtn) toggleBtn.textContent = "☀️";
    } else {
        document.documentElement.removeAttribute("data-theme");
        if (toggleBtn) toggleBtn.textContent = "🌙";
    }
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
