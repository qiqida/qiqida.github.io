// ==========================
// 通知详情页
// 支持两种正文来源：
// 1. notice.content：短通知直接写在 data/notices.json 中
// 2. notice.markdown：长通知写在 notices/*.md 中，适合放外部链接和分段内容
// ==========================

async function loadNotice() {

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    // 加时间戳是为了避免浏览器缓存旧通知，尤其适合 GitHub Pages 这种静态网站。
    const response = await fetch(`../data/notices.json?v=${Date.now()}`);
    const notices = await response.json();

    const notice = notices.find(item => item.id === id);

    if (!notice) {
        showNoticeError("没有找到这条通知，可能是链接已失效。");
        return;
    }

    document.getElementById("notice-title").textContent = notice.title;
    document.getElementById("notice-date").textContent = notice.date;

    const content = await getNoticeContent(notice);

    document.getElementById("notice-content").innerHTML = `
        <article class="notice-content-box markdown-body">
            ${content}
        </article>
    `;

    // GA 页面访问统计；如果没有接入 GA，这段不会影响页面显示。
    if (typeof gtag !== "undefined") {
        gtag('event', 'notice_view', {
            'notice_title': notice.title,
            'notice_id': notice.id
        });
    }
}

// 根据通知配置读取正文。优先读取 Markdown 文件，其次读取 JSON 里的 content。
async function getNoticeContent(notice) {

    if (notice.markdown) {
        try {
            const response = await fetch(`../${notice.markdown}?v=${Date.now()}`);

            if (!response.ok) {
                throw new Error("Markdown 文件读取失败");
            }

            const markdownText = await response.text();
            return parseMarkdown(markdownText);
        } catch (error) {
            console.error(error);
            return `<p>通知正文加载失败，请联系管理员检查 Markdown 文件路径。</p>`;
        }
    }

    return `<p>${escapeHtml(notice.content || "暂无正文。")}</p>`;
}

function showNoticeError(message) {
    document.getElementById("notice-content").innerHTML = `
        <div class="notice-content-box">
            ${escapeHtml(message)}
        </div>
    `;
}

// 简易 Markdown 解析器：
// 覆盖通知常用写法：标题、段落、列表、加粗、链接和分隔线。
function parseMarkdown(markdownText) {

    const lines = markdownText.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let listOpen = false;

    lines.forEach(line => {
        const trimmed = line.trim();

        if (!trimmed) {
            closeList();
            return;
        }

        if (trimmed === "---") {
            closeList();
            html.push("<hr>");
            return;
        }

        if (trimmed.startsWith("### ")) {
            closeList();
            html.push(`<h3>${parseInlineMarkdown(trimmed.slice(4))}</h3>`);
            return;
        }

        if (trimmed.startsWith("## ")) {
            closeList();
            html.push(`<h2>${parseInlineMarkdown(trimmed.slice(3))}</h2>`);
            return;
        }

        if (trimmed.startsWith("# ")) {
            closeList();
            html.push(`<h1>${parseInlineMarkdown(trimmed.slice(2))}</h1>`);
            return;
        }

        if (trimmed.startsWith("- ")) {
            if (!listOpen) {
                html.push("<ul>");
                listOpen = true;
            }

            html.push(`<li>${parseInlineMarkdown(trimmed.slice(2))}</li>`);
            return;
        }

        closeList();
        html.push(`<p>${parseInlineMarkdown(trimmed)}</p>`);
    });

    closeList();
    return html.join("");

    function closeList() {
        if (listOpen) {
            html.push("</ul>");
            listOpen = false;
        }
    }
}

// 先转义 HTML，再把 Markdown 的链接和加粗转换成安全的 HTML。
function parseInlineMarkdown(text) {

    return escapeHtml(text)
        .replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        )
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

loadNotice();
