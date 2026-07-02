// 主题初始化脚本 - 必须在所有样式之前执行，防止页面闪动
(function () {
    try {
        var theme = localStorage.getItem("gsh-theme");
        if (theme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
        }
    } catch (e) {
        // 忽略 localStorage 不可用的情况
    }
})();
