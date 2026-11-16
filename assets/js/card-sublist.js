// ==========================
// 首页板块卡片 · 子板块预览
// 说明：
//   数据来源：data/categories.json
//   桌面端：鼠标悬停卡片 → 卡片上浮并浮出该板块包含的子板块（不推挤其他卡片）
//   移动端：无 hover，点击「查看子板块」在卡片内就地展开（手风琴，同一时间只展开一个）
//   键盘：Tab 聚焦卡片自动展开；「查看子板块」可按 Enter / 空格切换
//   注意：卡片跳转由 .card-overlay 覆盖层承担，子项是独立链接，互不嵌套
// ==========================

(function () {
    "use strict";

    const grid = document.getElementById("card-grid");

    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll(".card[data-category]"));

    if (cards.length === 0) return;

    // 模式判定：视口宽度 >= 769 且设备支持 hover → 桌面浮层模式
    const DESKTOP_MIN_WIDTH = 769;

    let mode = "";

    function detectMode() {
        const wideEnough = window.innerWidth >= DESKTOP_MIN_WIDTH;
        const canHover = window.matchMedia("(hover: hover)").matches;

        return wideEnough && canHover ? "desktop" : "mobile";
    }

    function applyMode() {
        const next = detectMode();

        if (next === mode) return;

        mode = next;

        document.body.classList.toggle("mode-desktop", mode === "desktop");
        document.body.classList.toggle("mode-mobile", mode === "mobile");

        // 切换模式时收起所有卡片，避免状态残留
        collapseAll();
    }

    // ==========================
    // 渲染子板块列表
    // ==========================
    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, function (ch) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[ch];
        });
    }

    function renderItems(card, category) {
        const list = card.querySelector(".card-sublist");

        if (!list) return;

        const items = category.items || [];

        list.innerHTML = items
            .map(function (item) {
                return (
                    '<a class="card-subitem" href="' +
                    escapeHtml(item.url) +
                    '">' +
                    '<span class="card-subitem-name">' +
                    escapeHtml(item.name) +
                    "</span>" +
                    '<span class="card-subitem-type">' +
                    escapeHtml(item.type || "") +
                    "</span></a>"
                );
            })
            .join("");

        // 更新「查看子板块」文案为数量提示
        const toggle = card.querySelector(".card-toggle");

        if (toggle) {
            toggle.textContent = "查看 " + items.length + " 个子板块";
        }
    }

    // ==========================
    // 展开 / 收起动画
    // ==========================
    function measure(card) {
        const list = card.querySelector(".card-sublist");

        if (!list) return 0;

        // 临时解除高度限制以获取真实高度
        const prev = list.style.maxHeight;

        list.style.maxHeight = "none";

        const h = list.scrollHeight;

        list.style.maxHeight = prev;

        return h;
    }
    function expand(card) {
        const list = card.querySelector(".card-sublist");

        if (!list || card.classList.contains("is-expanded")) return;

        const h = measure(card);

        card.classList.add("is-expanded");

        // 强制回流后再设置目标高度，保证过渡动画生效
        void list.offsetHeight;

        list.style.maxHeight = h + "px";

        const toggle = card.querySelector(".card-toggle");

        if (toggle) {
            toggle.setAttribute("aria-expanded", "true");
            toggle.textContent = "收起子板块";
        }
    }

    function collapse(card) {
        const list = card.querySelector(".card-sublist");

        if (!list || !card.classList.contains("is-expanded")) return;

        card.classList.remove("is-expanded");

        list.style.maxHeight = "0px";

        const toggle = card.querySelector(".card-toggle");

        if (toggle) {
            toggle.setAttribute("aria-expanded", "false");
            toggle.textContent = "查看 " + list.children.length + " 个子板块";
        }
    }

    /**
     * 用户主动收起（点击「收起子板块」）
     * 桌面端需要记住这个意图：按钮立刻隐藏，并且不再被 focusin 自动展开，
     * 直到鼠标真正离开并重新进入该卡片。
     */
    function collapseByUser(card) {
        collapse(card);

        if (mode !== "desktop") return;

        card.classList.add("user-collapsed");
    }

    function collapseAll(except) {
        cards.forEach(function (card) {
            if (card !== except) collapse(card);
        });
    }

    function toggleCard(card) {
        const isOpen = card.classList.contains("is-expanded");

        collapseAll();

        if (!isOpen) {
            // 展开时清除"用户已收起"标记
            card.classList.remove("user-collapsed");
            expand(card);
        } else {
            collapseByUser(card);
        }
    }

    // ==========================
    // 加载数据
    // ==========================
    async function loadCategories() {
        try {
            const response = await fetch("data/categories.json");

            if (!response.ok) throw new Error("子板块数据读取失败");

            const categories = await response.json();

            cards.forEach(function (card) {
                const key = card.getAttribute("data-category");
                const category = categories[key];

                if (!category) return;

                renderItems(card, category);
            });
        } catch (error) {
            console.error("子板块数据加载失败", error);
        }
    }

    // ==========================
    // 交互绑定
    // ==========================
    function bindEvents() {
        // 「查看子板块」按钮：点击切换展开（两种设备都可用）
        grid.addEventListener("click", function (event) {
            const toggle = event.target.closest(".card-toggle");

            if (toggle) {
                event.preventDefault();
                event.stopPropagation();

                const card = toggle.closest(".card");

                if (!card) return;

                toggleCard(card);
            }
        });

        // 「查看子板块」按钮的键盘操作
        grid.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
                return;
            }

            const toggle = event.target.closest(".card-toggle");

            if (!toggle) return;

            event.preventDefault();
            event.stopPropagation();

            const card = toggle.closest(".card");

            if (card) toggleCard(card);
        });

        // 桌面端：悬停展开
        cards.forEach(function (card) {
            card.addEventListener("mouseenter", function () {
                if (mode !== "desktop") return;

                // 鼠标重新进入时解除"用户已收起"状态
                card.classList.remove("user-collapsed");

                collapseAll(card);
                expand(card);
            });

            card.addEventListener("mouseleave", function () {
                if (mode !== "desktop") return;

                collapse(card);
                card.classList.remove("user-collapsed");
            });

            // 键盘可达：聚焦时展开
            card.addEventListener("focusin", function () {
                if (mode !== "desktop") return;

                // 用户主动收起后，焦点再次进入时不自动展开，避免"收起后立刻弹回"
                if (card.classList.contains("user-collapsed")) return;

                collapseAll(card);
                expand(card);
            });

            card.addEventListener("focusout", function (event) {
                if (mode !== "desktop") return;

                // 若焦点仍留在卡片内部则不收起
                if (!card.contains(event.relatedTarget)) {
                    collapse(card);
                }
            });
        });

        // 整个卡片区域鼠标移出时收起所有
        grid.addEventListener("mouseleave", function () {
            if (mode !== "desktop") return;

            collapseAll();
        });
    }

    // ==========================
    // 启动
    // ==========================
    applyMode();
    bindEvents();
    loadCategories();

    // 视口尺寸或 hover 能力变化时重新判定模式
    let resizeTimer = null;

    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(function () {
            applyMode();

            // 桌面端浮层展开时，窗口尺寸变化需要重新测量高度
            if (mode !== "desktop") return;

            cards.forEach(function (card) {
                if (!card.classList.contains("is-expanded")) return;

                const list = card.querySelector(".card-sublist");

                if (!list) return;

                list.style.maxHeight = "none";

                const h = list.scrollHeight;

                list.style.maxHeight = h + "px";
            });
        }, 150);
    });
})();
