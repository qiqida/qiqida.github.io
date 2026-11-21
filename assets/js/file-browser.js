// ==========================
// 文件专区：附件浏览器
//
// 数据来自 data/downloads.json（构建期生成）。
// 提供：关键词搜索 + 分类筛选 + 格式筛选。
//
// 只在文件专区的总览页加载；别的页面没有 #file-browser 容器，
// 脚本会自己跳过，不会报错。
// ==========================

(function () {
    "use strict";

    const root = document.getElementById("file-browser");
    if (!root) return;

    // 筛选状态
    let allFiles = [];
    let currentCategory = "all";   // 分类筛选
    let currentExtGroup = "all";    // 格式筛选
    let currentKeyword = "";        // 关键词

    // ---------- 工具 ----------

    // 把关键词转成拼音首字母，查表用
    let pinyinTable = {};

    function toInitials(text) {
        let out = "";
        for (const ch of text) {
            const ini = pinyinTable[ch];
            out += ini || ch;
        }
        return out.toLowerCase();
    }

    // 文件名里可能带中文拼音，做一次宽松匹配
    function matchesKeyword(file, keyword) {
        if (!keyword) return true;

        const haystack = (file.title + " " + file.category).toLowerCase();
        if (haystack.includes(keyword)) return true;

        // 拼音首字母匹配：qjtsq → 请假条申请表
        // file.initials 是构建期算好的「标题首字母 + 分类首字母」
        if (file.initials) {
            const flat = file.initials.replace(/\s+/g, "");
            if (flat.includes(keyword)) return true;
        }

        return false;
    }

    function filtered() {
        return allFiles.filter(file => {
            if (currentCategory !== "all" && file.categoryKey !== currentCategory) {
                return false;
            }
            if (currentExtGroup !== "all" && file.extGroup !== currentExtGroup) {
                return false;
            }
            if (!matchesKeyword(file, currentKeyword)) {
                return false;
            }
            return true;
        });
    }

    // ---------- 渲染 ----------

    function extIconClass(file) {
        const g = file.extGroup || "other";
        return "file-icon " + g;
    }

    function extIconText(file) {
        const e = (file.ext || "").replace(".", "");
        return (e || "文件").toUpperCase().slice(0, 4);
    }

    function renderList(files) {
        const list = root.querySelector("#file-list");
        const countEl = root.querySelector("#file-count");
        if (!list) return;

        if (countEl) {
            const total = allFiles.length;
            countEl.textContent = files.length === total
                ? "共 " + total + " 个文件"
                : "筛选出 " + files.length + " / " + total + " 个";
        }

        if (files.length === 0) {
            list.innerHTML =
                '<li class="file-empty">' +
                "没有匹配的文件" +
                '<span class="file-empty-hint">换个关键词，或把筛选切回「全部」</span>' +
                "</li>";
            return;
        }

        list.innerHTML = files.map(file =>
            '<li><a class="file-item" href="../' + escapeAttr(file.file) + '" download>' +
            '<span class="' + extIconClass(file) + '">' + escapeHtml(extIconText(file)) + "</span>" +
            '<span class="file-info">' +
            '<p class="file-name">' + escapeHtml(file.title) + "</p>" +
            '<p class="file-meta">' +
            "<span>" + escapeHtml(file.category || "") + "</span>" +
            "<span>" + escapeHtml(file.extLabel || "") + "</span>" +
            "<span>" + escapeHtml(file.sizeText || "") + "</span>" +
            "</p></span>" +
            '<span class="file-download">下载 →</span>' +
            "</a></li>"
        ).join("");
    }

    function escapeHtml(text) {
        return String(text == null ? "" : text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function escapeAttr(text) {
        return escapeHtml(text).replace(/"/g, "&quot;");
    }

    // ---------- 筛选按钮 ----------

    function updateFilterCounts() {
        // 按「当前关键词 + 另一维度」统计数量，
        // 让用户知道点某个分类大概能看到多少个。
        const catCounts = {};
        const extCounts = {};

        allFiles.forEach(file => {
            if (!matchesKeyword(file, currentKeyword)) return;

            if (currentExtGroup === "all" || file.extGroup === currentExtGroup) {
                catCounts[file.categoryKey] = (catCounts[file.categoryKey] || 0) + 1;
            }
            if (currentCategory === "all" || file.categoryKey === currentCategory) {
                extCounts[file.extGroup] = (extCounts[file.extGroup] || 0) + 1;
            }
        });

        root.querySelectorAll("[data-filter-cat]").forEach(btn => {
            const key = btn.getAttribute("data-filter-cat");
            const n = key === "all" ? allFiles.length : (catCounts[key] || 0);
            const badge = btn.querySelector(".file-filter-n");
            if (badge) badge.textContent = n;
            btn.classList.toggle("active", key === currentCategory);
        });

        root.querySelectorAll("[data-filter-ext]").forEach(btn => {
            const key = btn.getAttribute("data-filter-ext");
            const n = key === "all" ? allFiles.length : (extCounts[key] || 0);
            const badge = btn.querySelector(".file-filter-n");
            if (badge) badge.textContent = n;
            btn.classList.toggle("active", key === currentExtGroup);
        });
    }

    function refresh() {
        updateFilterCounts();
        renderList(filtered());
    }

    // ---------- 初始化 ----------

    // 本脚本在 pages/ 子目录下运行，
    // 数据文件在站点根的 data/ 下，所以要加 ../ 前缀。
    const DATA_BASE = "../data/";

    async function init() {
        const list = root.querySelector("#file-list");
        if (list) {
            list.innerHTML = '<li class="file-loading">正在加载文件清单…</li>';
        }

        // 拼音表是可选的，取不到不影响中文搜索
        try {
            const res = await fetch(DATA_BASE + "pinyin-table.json");
            if (res.ok) pinyinTable = await res.json();
        } catch (e) {
            /* 忽略 */
        }

        let data = [];
        try {
            const res = await fetch(DATA_BASE + "downloads.json");
            if (!res.ok) throw new Error("HTTP " + res.status);
            data = await res.json();
        } catch (error) {
            console.error("文件清单加载失败", error);
            if (list) {
                list.innerHTML =
                    '<li class="file-empty">文件清单暂时加载不出来' +
                    '<span class="file-empty-hint">可以直接刷新页面再试</span></li>';
            }
            return;
        }

        allFiles = Array.isArray(data) ? data : [];

        // 分类按钮
        const catBox = root.querySelector("#file-cat-filters");
        if (catBox) {
            const cats = [];
            const seen = {};
            allFiles.forEach(f => {
                if (!seen[f.categoryKey]) {
                    seen[f.categoryKey] = true;
                    cats.push({ key: f.categoryKey, label: f.category });
                }
            });
            catBox.innerHTML =
                '<button type="button" class="file-filter active" data-filter-cat="all">' +
                "全部分类<span class=\"file-filter-n\">0</span></button>" +
                cats.map(c =>
                    '<button type="button" class="file-filter" data-filter-cat="' +
                    escapeAttr(c.key) + '">' + escapeHtml(c.label) +
                    '<span class="file-filter-n">0</span></button>'
                ).join("");
        }

        // 格式按钮
        const extBox = root.querySelector("#file-ext-filters");
        if (extBox) {
            const groups = [];
            const seen = {};
            allFiles.forEach(f => {
                if (!seen[f.extGroup]) {
                    seen[f.extGroup] = true;
                    groups.push({ key: f.extGroup, label: f.extLabel });
                }
            });
            extBox.innerHTML =
                '<button type="button" class="file-filter active" data-filter-ext="all">' +
                "全部格式<span class=\"file-filter-n\">0</span></button>" +
                groups.map(g =>
                    '<button type="button" class="file-filter" data-filter-ext="' +
                    escapeAttr(g.key) + '">' + escapeHtml(g.label) +
                    '<span class="file-filter-n">0</span></button>'
                ).join("");
        }

        // 事件绑定
        root.addEventListener("click", function (e) {
            const catBtn = e.target.closest("[data-filter-cat]");
            if (catBtn) {
                currentCategory = catBtn.getAttribute("data-filter-cat");
                refresh();
                return;
            }
            const extBtn = e.target.closest("[data-filter-ext]");
            if (extBtn) {
                currentExtGroup = extBtn.getAttribute("data-filter-ext");
                refresh();
            }
        });

        const input = root.querySelector("#file-search-input");
        if (input) {
            input.addEventListener("input", function () {
                currentKeyword = input.value.trim().toLowerCase();
                refresh();
            });
        }

        refresh();
    }

    init();
})();
