// ==========================
// 搜索结果页
//
// 用法：search.html?q=请假
//
// 为什么要有这个页面：
//   下拉框最多显示 6 条，搜不到更多。
//   学生搜「请」想看全部匹配、或者搜了个不存在的词想找人问，
//   都需要一个能承接的页面。
//
// 这个页面完全在浏览器里跑，数据还是那份 knowledge-base.json，
// 不需要后端，也不需要构建时预生成。
// ==========================

(function () {
    "use strict";

    // 根节点。用 .search-page 找，而不是 id ——
    // 避免和 <main id="main-content">（skip-link 的目标）冲突。
    const root = document.querySelector(".search-page");
    if (!root) return;

    const input = document.getElementById("search-page-input");
    const countEl = document.getElementById("search-page-count");
    const listEl = document.getElementById("search-results");
    const relatedEl = document.getElementById("search-related-list");
    const relatedBox = document.getElementById("search-related");

    // 站点根前缀。首页是 ""，子页是 "../"。
    const SITE_ROOT = (() => {
        const attr = document.body ? document.body.getAttribute("data-root") : null;
        if (attr !== null && attr !== undefined) {
            return attr.endsWith("/") ? attr : attr + "/";
        }
        return "";
    })();

    function siteUrl(path) {
        if (!path) return SITE_ROOT || "./";
        if (/^(https?:)?\/\//.test(path) || path.startsWith("#")) return path;
        return SITE_ROOT + path;
    }

    let searchData = [];
    let pinyinTable = {};

    // ==========================================================
    // 加载数据
    // ==========================================================
    async function loadData() {
        const ver = window.SITE_VER || "1";
        try {
            const res = await fetch(siteUrl("data/knowledge-base.json") + "?v=" + ver);
            if (!res.ok) throw new Error("搜索数据读取失败");
            searchData = await res.json();
        } catch (error) {
            console.error(error);
            showStatus("搜索数据加载失败，请稍后重试。");
            return false;
        }

        // 拼音表是可选的，取不到不影响中文搜索
        try {
            const res = await fetch(siteUrl("data/pinyin-table.json") + "?v=" + ver);
            if (res.ok) pinyinTable = await res.json();
        } catch (error) {
            /* 忽略 */
        }

        // API 地址（搜索词上报用）
        await loadApiBase();

        return true;
    }

    // ==========================================================
    // 匹配逻辑（与 search.js 保持一致）
    // ==========================================================
    function toInitials(text) {
        let out = "";
        for (const ch of text) {
            out += pinyinTable[ch] || ch;
        }
        return out.toLowerCase();
    }

    function getSearchText(item) {
        const keywords = Array.isArray(item.keywords) ? item.keywords.join(" ") : "";
        return `${item.title} ${item.category} ${keywords}`.toLowerCase();
    }

    /**
     * 按词逐个匹配首字母，不把 initials 拍平。
     *
     * 拍平会跨词边界产生假匹配：
     *   「毕业设计」→ initials = "bysj bs kt zqjc cz lw"
     *   拍平成 "bysjbsktzqjcczlw" 后里面就有 "qj"，
     *   搜「请假」就会把「毕业设计」也命中，纯属误报。
     *
     * 只认开头（startsWith）不认中间（includes）：
     *   「入学教育与体检」的「安全教育考试」首字母是 "aqjyks"，含 "qj"，
     *   用 includes 会误命中。
     *   学生搜 "qj" 要的永远是「请假」这种以 qj 开头的词。
     */
    function matchesPinyin(item, value) {
        if (!item.initials) return false;
        const tokens = item.initials.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
            if (token.startsWith(value)) return true;
        }
        return false;
    }

    /**
     * 全拼保留 includes —— 全拼串长，误命中概率低，
     * 但要支持搜 "qingjia" 命中 "qingjiaband"（请假报销单）这种场景。
     */
    function matchesFullPinyin(item, value) {
        if (!item.pinyin) return false;
        const tokens = item.pinyin.split(/\s+/).filter(Boolean);
        for (const token of tokens) {
            if (token.includes(value)) return true;
        }
        return false;
    }

    /**
     * 返回 [{ item, score, matchedFields }]，按相关度排序。
     *
     * 与首页下拉的差别：
     *   · 不截断（全部结果都列出来）
     *   · 排序（标题命中最靠前）
     */
    function findMatches(keyword) {
        const value = keyword.trim().toLowerCase();
        if (!value) return [];

        const results = [];

        for (const item of searchData) {
            const title = (item.title || "").toLowerCase();
            const desc = (item.desc || "").toLowerCase();
            const keywords = Array.isArray(item.keywords)
                ? item.keywords.join(" ").toLowerCase()
                : "";
            const text = getSearchText(item);

            let score = 0;
            let matched = false;

            // 标题完全相同 —— 最高分
            if (title === value) {
                score = 100;
                matched = true;
            }
            // 标题开头包含
            else if (title.startsWith(value)) {
                score = 80;
                matched = true;
            }
            // 标题包含
            else if (title.includes(value)) {
                score = 60;
                matched = true;
            }
            // 关键词包含
            else if (keywords.includes(value)) {
                score = 40;
                matched = true;
            }
            // 简介包含
            else if (desc.includes(value)) {
                score = 20;
                matched = true;
            }

            if (!matched) {
                // 拼音匹配
                //
                // 按词逐个匹配，不把 initials 拍平。
                // 拍平会跨词边界产生假匹配：
                // 「毕业设计」的 initials 是 "bysj kt zqj cc lw"，
                // 拍平后含 "qj"，搜「请假」就会把「毕业设计」也命中。
                if (/^[a-z]+$/.test(value)) {
                    if (matchesPinyin(item, value)) { score = 50; matched = true; }
                    if (!matched && matchesFullPinyin(item, value)) { score = 45; matched = true; }
                } else if (item.initials) {
                    const initials = toInitials(value);
                    if (initials !== value && matchesPinyin(item, initials)) {
                        score = 35;
                        matched = true;
                    }
                }
            }

            if (matched) {
                // 「专区总览」页是导航页，不是办事内容本身。
                // 搜「请假」时，学生要的是具体流程，不是「在校学习专区」这个目录。
                // 所以专区页整体降权，排在具体页面后面。
                if (item.category === "专区总览") {
                    score = Math.max(1, Math.floor(score / 3));
                }
                results.push({ item: item, score: score });
            }
        }

        // 分数高的在前；同分按标题排（稳定一点）
        results.sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return (a.item.title || "").localeCompare(b.item.title || "", "zh-CN");
        });

        return results;
    }

    // ==========================================================
    // 渲染
    // ==========================================================
    function escapeHtml(text) {
        return String(text == null ? "" : text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /**
     * 把命中的关键词高亮。
     * 只高亮标题和简介，不动 HTML 结构（避免 XSS）。
     */
    function highlight(text, keyword) {
        const safe = escapeHtml(text);
        if (!keyword) return safe;

        const needle = keyword.trim();
        if (!needle) return safe;

        // 只处理长度 >= 2 的词，避免单字高亮满屏都是
        if (needle.length < 2) return safe;

        const pattern = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return safe.replace(
            new RegExp("(" + pattern + ")", "gi"),
            '<span class="search-hit">$1</span>'
        );
    }

    function showStatus(message) {
        if (countEl) countEl.textContent = "";
        if (listEl) {
            listEl.innerHTML = "";
            const li = document.createElement("li");
            li.className = "search-status";
            li.textContent = message;
            listEl.appendChild(li);
        }
    }

    function renderEmpty(keyword) {
        if (countEl) countEl.textContent = "";

        if (listEl) {
            listEl.innerHTML = "";

            const li = document.createElement("li");
            li.className = "search-empty";

            // 空结果时给出专区入口 —— 让学生有路可走，
            // 而不是只丢一句「没找到」。
            const zones = [
                { key: "study", title: "在校学习专区" },
                { key: "aid", title: "奖助专区" },
                { key: "life", title: "生活与证件专区" },
                { key: "career", title: "实习就业与毕业专区" },
                { key: "download", title: "文件专区" },
                { key: "faq", title: "问题专区" },
            ];

            const zoneLinks = zones.map(function (z) {
                return `<a class="search-empty-zone" href="${siteUrl("pages/" + z.key + ".html")}">${escapeHtml(z.title)}</a>`;
            }).join("");

            li.innerHTML = `
                <p class="search-empty-title">没有找到「${escapeHtml(keyword)}」</p>
                <p class="search-empty-desc">
                    可能是换个说法更准，比如「请假」也可以搜「qj」、「考勤」。
                    <br>还是找不到？直接去下面的专区看看，或者留言告诉我们。
                </p>
                <div class="search-empty-zones">${zoneLinks}</div>
                <p class="search-empty-desc" style="margin-bottom:0;">
                    <a href="${siteUrl("index.html")}#feedback">找不到答案？留言问我们 →</a>
                </p>
            `;
            listEl.appendChild(li);
        }

        renderRelated(keyword);
    }

    function renderRelated(keyword) {
        if (!relatedEl || !relatedBox) return;

        // 相关搜索词：从搜索索引的标题里挑几个和关键词沾边的
        const related = searchData
            .map(function (item) { return item.title; })
            .filter(function (t) {
                if (!t) return false;
                // 排除和当前关键词完全一样的
                return t !== keyword;
            })
            .slice(0, 10);

        if (related.length === 0) {
            // 用 hidden 属性控制显隐，不能只设 style.display ——
            // 模板里这个区块带 hidden 属性，只改 style 的话
            // 元素还是 hidden 状态，内容渲染了也看不见。
            relatedBox.setAttribute("hidden", "");
            return;
        }

        relatedBox.removeAttribute("hidden");
        relatedEl.innerHTML = related.map(function (t) {
            return `<a class="search-related-tag" href="${siteUrl("pages/search.html?q=" + encodeURIComponent(t))}">${escapeHtml(t)}</a>`;
        }).join("");
    }

    function render(keyword) {
        if (!keyword) {
            showStatus("输入关键词开始搜索。");
            if (relatedBox) relatedBox.setAttribute("hidden", "");
            return;
        }

        const results = findMatches(keyword);

        if (results.length === 0) {
            renderEmpty(keyword);
            return;
        }

        if (countEl) {
            countEl.innerHTML = `找到 <strong>${results.length}</strong> 条与「${escapeHtml(keyword)}」相关的内容`;
        }

        if (listEl) {
            listEl.innerHTML = results.map(function (r) {
                const item = r.item;
                return `
                    <li>
                        <a class="search-result" href="${siteUrl(item.url)}">
                            <div class="search-result-head">
                                <h3 class="search-result-title">${highlight(item.title, keyword)}</h3>
                                <span class="search-result-zone">${escapeHtml(item.category || "事务服务")}</span>
                            </div>
                            ${item.desc ? `<p class="search-result-desc">${highlight(item.desc, keyword)}</p>` : ""}
                        </a>
                    </li>
                `;
            }).join("");
        }

        renderRelated(keyword);
    }

    // ==========================================================
    // Worker API 地址
    //
    // 从 data/site-config.json 的 apiBase 读，改地址只改配置一处。
    // 读不到就用默认值兜底 —— 不该因为配置缺失就让搜索崩掉。
    // ==========================================================
    const DEFAULT_API_BASE = "https://qiqida-stats-worker.dddhui-qi.workers.dev/api";
    let apiBase = DEFAULT_API_BASE;

    async function loadApiBase() {
        try {
            const res = await fetch(siteUrl("data/site-config.json") + "?v=" + (window.SITE_VER || "1"));
            if (res.ok) {
                const cfg = await res.json();
                if (cfg && cfg.apiBase) {
                    apiBase = cfg.apiBase.replace(/\/+$/, "");
                }
            }
        } catch (error) {
            /* 忽略：用默认值 */
        }
    }

    // ==========================================================
    // 搜索词上报
    //
    // 与 search.js 里的是同一套逻辑（同一个词 30 分钟内只报一次），
    // 但这里是独立的一份 —— 两个脚本互不依赖，各自能单独工作。
    //
    // 只上报关键词本身，不带任何个人信息。
    // 上报失败完全不影响搜索功能。
    // ==========================================================
    const SEARCH_REPORT_DEDUP_MS = 30 * 60 * 1000;   // 30 分钟

    function reportSearch(keyword) {
        const value = (keyword || "").trim();
        if (!value || value.length > 30) return;
        if (value.length < 2) return;

        try {
            const storeKey = "srch:" + value;
            const last = parseInt(sessionStorage.getItem(storeKey) || "0", 10);
            if (Date.now() - last < SEARCH_REPORT_DEDUP_MS) return;
            sessionStorage.setItem(storeKey, String(Date.now()));
        } catch (e) {
            /* sessionStorage 不可用时不影响搜索 */
        }

        try {
            fetch(apiBase + "/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword: value }),
            }).catch(function () { /* 失败不影响搜索 */ });
        } catch (e) {
            /* 同上 */
        }
    }

    // ==========================================================
    // 交互
    // ==========================================================
    function currentQuery() {
        const params = new URLSearchParams(window.location.search);
        return (params.get("q") || "").trim();
    }

    function updateUrl(keyword) {
        const url = new URL(window.location.href);
        if (keyword) {
            url.searchParams.set("q", keyword);
        } else {
            url.searchParams.delete("q");
        }
        // 用 replaceState，避免每次输入都往历史里塞一条
        window.history.replaceState({}, "", url.toString());
    }

    if (input) {
        input.addEventListener("input", function () {
            const value = this.value.trim();
            updateUrl(value);
            render(value);
            // 边输入边上报（内部有去重，同一个词 30 分钟只报一次），
            // 这样能知道学生到底在搜什么词，
            // 哪怕他最后没点进任何结果。
            if (value.length >= 2) reportSearch(value);
        });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                const value = this.value.trim();
                updateUrl(value);
                render(value);
                if (value && listEl && listEl.firstElementChild) {
                    const first = listEl.querySelector(".search-result");
                    if (first) first.focus();
                }
            }
        });
    }

    // ==========================================================
    // 启动
    // ==========================================================
    (async function init() {
        const keyword = currentQuery();
        if (input) input.value = keyword;

        showStatus("正在加载搜索数据…");

        const ok = await loadData();
        if (!ok) return;

        render(keyword);

        // 从别处点「查看全部结果」跳过来时，聚焦搜索框方便继续改
        if (keyword && input) {
            input.focus();
            // 把光标放到末尾，别把用户已有的输入弄乱
            const len = input.value.length;
            input.setSelectionRange(len, len);
        }
    })();
})();
