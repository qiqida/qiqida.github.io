// ==========================
// Mermaid 流程图初始化
//
// 说明：流程页里的 ```mermaid 代码块会被转成：
//   <div class="mermaid-block">
//     <template class="mermaid-source">源码</template>
//     <pre class="mermaid-pre"></pre>
//   </div>
//
// 为什么不直接用官方的 <pre class="mermaid"> 写法：
// mermaid 脚本加载后会自动扫描页面里所有 .mermaid 元素并渲染，
// 但那用的是默认配置（htmlLabels: true）——
// 节点文字宽度靠 foreignObject 实测，页面刚打开时量不准，
// 每个节点只剩 14px 宽，整张图被压成 100 多像素、竖着排成一条线，
// 看上去就是「流程图没显示内容」。
//
// 所以这里自己掌控：
//   1. 页面 <head> 里在 mermaid 脚本之前设好 window.mermaidConfig
//      （htmlLabels: false + useMaxWidth: false）
//   2. 等 DOM 与字体就绪后再渲染
//   3. 图太宽（手机上要左右拖）就自动改成竖向重排
//   4. 渲染失败时降级显示源码，不留空白
// ==========================

(function () {
    "use strict";

    function currentTheme() {
        return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default";
    }

    function escapeText(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function config() {
        return {
            startOnLoad: false,
            securityLevel: "loose",
            theme: currentTheme(),
            // 不让 mermaid 把 SVG 压到 max-width，
            // 否则图会被按容器宽度缩小，看不清。
            useMaxWidth: false,
            fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
            flowchart: {
                curve: "basis",
                // 用纯 SVG <text>，不要 foreignObject。
                // foreignObject 里的 HTML 文字要靠浏览器实测宽度，
                // 在这个页面里实测宽度是 0，节点框会被压成十几像素宽，
                // 文字挤成竖条 —— 看上去就是「流程图没显示内容」。
                htmlLabels: false,
                padding: 14,
                nodeSpacing: 40,
                rankSpacing: 50
            },
            themeVariables: {
                primaryColor: "#e8f2ff",
                primaryTextColor: "#1d1d1f",
                primaryBorderColor: "#0071e3",
                lineColor: "#86868b",
                secondaryColor: "#f5f5f7",
                tertiaryColor: "#ffffff"
            }
        };
    }

    // ---------- 收集需要渲染的图 ----------

    function collect() {
        var items = [];

        Array.prototype.slice.call(document.querySelectorAll(".mermaid-block")).forEach(function (block) {
            var tpl = block.querySelector(".mermaid-source");
            var pre = block.querySelector("pre.mermaid-pre");
            if (!tpl || !pre) return;

            var source = tpl.content ? tpl.content.textContent : "";
            if (!source.trim()) return;

            items.push({ block: block, pre: pre, source: source, attempts: 0 });
        });

        return items;
    }

    // ---------- 渲染 ----------

    var renderSeq = 0;

    // 串行渲染：一张接一张，等上一张完成再画下一张。
    // 并发调用会让 mermaid 内部状态还没准备好，结果节点宽度量错。
    function drawAll(items, index) {
        index = index || 0;
        if (index >= items.length) return;

        draw(items[index], function () {
            drawAll(items, index + 1);
        });
    }

    function draw(item, done) {
        var pre = item.pre;
        var source = item.source;

        var id = "gsh-mermaid-" + (renderSeq++);

        var result;
        try {
            result = mermaid.render(id, source);
        } catch (err) {
            showError(pre, source, err);
            if (done) done();
            return;
        }

        var promise = result && typeof result.then === "function" ? result : Promise.resolve(result);

        promise.then(function (rendered) {
            var svg = rendered && rendered.svg;
            if (!svg) {
                showError(pre, source, new Error("未生成 SVG"));
                if (done) done();
                return;
            }

            var width = svgWidth(svg);

            // 注意：这里不要因为「图太宽」就自动改成竖向。
            // 横向流程图在窄屏上横向滚动查看即可，
            // 自动改成竖向会把结构复杂的流程图（分支多、层级深）挤成一长条，
            // 反而更难读。
            // 宽度明显偏小才需要重试（mermaid 内部测量器没就绪时会出现）。
            if (width < estimateMinWidth(source)) {
                item.attempts += 1;
                if (item.attempts <= 4) {
                    setTimeout(function () {
                        Promise.resolve().then(function () {
                            draw(item, done);
                        });
                    }, 400);
                    return;
                }
            }

            pre.innerHTML = svg;

            // 让 SVG 按原始尺寸显示（不随容器宽度缩小）。
            // mermaid 生成的 SVG 只有 width="100%"，浏览器会按容器宽度
            // 等比缩小整张图，节点文字也跟着变小。
            // 这里显式写出宽高，图超宽时容器可以横向滚动查看。
            var svgEl = pre.querySelector("svg");
            if (svgEl) {
                var vb = (svgEl.getAttribute("viewBox") || "").split(/\s+/);
                var vw = parseFloat(vb[2]) || 0;
                var vh = parseFloat(vb[3]) || 0;
                if (vw > 0 && vh > 0) {
                    svgEl.removeAttribute("width");
                    svgEl.removeAttribute("height");
                    svgEl.removeAttribute("style");
                    svgEl.setAttribute("width", String(Math.round(vw)));
                    svgEl.setAttribute("height", String(Math.round(vh)));
                }
            }

            pre.removeAttribute("data-processed");
            pre.classList.add("is-rendered");
            item.block.classList.add("is-rendered");
            if (done) done();
        }).catch(function (err) {
            showError(pre, source, err);
            if (done) done();
        });
    }

    function svgWidth(svg) {
        var vb = (svg.match(/viewBox="([^"]+)"/) || [])[1];
        if (!vb) return 0;
        var parts = vb.split(/\s+/);
        return parseFloat(parts[2]) || 0;
    }

    // 这张图至少该有多宽（按节点数估个下限）
    function estimateMinWidth(source) {
        var nodes = (source.match(/\[[^\]]*\]|\{[^}]*\}|\([^)]*\)/g) || []).length;
        if (nodes <= 1) return 0;
        return nodes * 40;
    }

    function showError(pre, source, err) {
        console.error("Mermaid 渲染失败", err);
        pre.innerHTML =
            '<div class="mermaid-fallback">' +
            '<p class="mermaid-fallback-title">流程图暂时无法显示，下面是流程文字：</p>' +
            '<pre class="code-block"><code>' + escapeText(source) + "</code></pre>" +
            "</div>";
        pre.classList.add("mermaid-error");
    }

    // ---------- 启动 ----------

    function renderAll() {
        var items = collect();
        if (items.length === 0) return;

        // 关键：必须用完整配置初始化，且要等配置真正生效再渲染。
        //
        // htmlLabels: false —— 用纯 SVG <text> 而不是 foreignObject。
        // foreignObject 里的 HTML 文字宽度要靠浏览器实测，
        // 在这个页面里实测结果是 0（可能与页面的 flex/grid 布局有关），
        // 于是每个节点只剩十几像素宽，文字挤成竖条，
        // 整张图被压成 100 多像素 —— 看上去就是「没显示内容」。
        //
        // initialize 的配置生效是异步的，直接接着 render 拿到的还是旧配置，
        // 所以这里轮询等 htmlLabels 真的变成 false 再画。
        mermaid.initialize(config());

        waitConfig(function () {
            drawAll(items, 0);
        }, 0);
    }

    // 等 mermaid 的配置真正生效
    function waitConfig(done, attempt) {
        attempt = attempt || 0;

        var ok = false;
        try {
            var cfg = mermaid.mermaidAPI.getConfig();
            ok = cfg.flowchart && cfg.flowchart.htmlLabels === false
                 && cfg.useMaxWidth === false;
        } catch (e) { /* ignore */ }

        if (ok) {
            done();
            return;
        }

        if (attempt < 60) {
            setTimeout(function () { waitConfig(done, attempt + 1); }, 50);
        } else {
            done();
        }
    }

    window.addEventListener("themechange", function () {
        setTimeout(renderAll, 150);
    });

    // mermaid 是普通 script（阻塞加载），到 body 末尾时应该已经就绪；
    // 万一还没好就轮询等一下。
    //
    // CDN 加载失败（国内网络不稳、或 jsdelivr 被墙）时，
    // 轮询到底仍然拿不到 mermaid，这时降级显示流程文字，
    // 至少让学生看得到步骤，不会留下一片空白。
    function fallbackAll() {
        var items = collect();
        if (items.length === 0) return;
        items.forEach(function (item) {
            showError(item.pre, item.source, new Error("mermaid 库加载失败"));
        });
    }

    function waitAndInit(attempt) {
        attempt = attempt || 0;
        if (typeof mermaid === "undefined") {
            // CDN 直接报错（onerror 已标记）时，不用等满 40 次
            if (window.__mermaidLoadFailed) {
                console.warn("mermaid CDN 加载失败，流程图降级为文字显示");
                fallbackAll();
                return;
            }
            if (attempt < 40) {
                setTimeout(function () { waitAndInit(attempt + 1); }, 150);
            } else {
                console.warn("mermaid 库未能加载，流程图降级为文字显示");
                fallbackAll();
            }
            return;
        }
        // 直接渲染，不要等 document.fonts.ready ——
        // fonts.ready 的 resolve 时机不好把握，会把渲染推迟到不合适的时刻。
        setTimeout(renderAll, 300);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            waitAndInit();
        });
    } else {
        waitAndInit();
    }
})();
