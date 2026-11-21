# -*- coding: utf-8 -*-
"""
md2html.py —— 把 Markdown 转成静态 HTML 页面（构建期一次性运行）

把「网站内容信息」的 md 正文，按站点的页面模板转成可直接部署的 .html，
产出纯静态页面，不依赖任何前端渲染库。

支持的 Markdown 语法：
  # ## ### #### 标题
  段落、**加粗**、*斜体*、`行内代码`
  - 无序列表、1. 有序列表
  > 引用块
  | 表格 | 语法 |
  ```mermaid 流程图、``` 代码块
  --- 分隔线
  [链接](路径) 、![图片](路径)
  【　】占位符（自动渲染成待填写高亮样式）

用法：
  python md2html.py <输入.md> <输出.html> --title "页面标题"
"""
import io
import os
import re
import sys
import time


# ==========================================================
# 页面模板
# 用 @@占位符@@ 而不是 str.format，避免与模板里的 JS 花括号冲突
# ==========================================================
PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">

<script async src="https://www.googletagmanager.com/gtag/js?id=G-2S0K5DDSME"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-2S0K5DDSME');
</script>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@@TITLE@@ | 工学部研究生事务服务中心</title>

    <!-- Favicon 图标 -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">
    <link rel="apple-touch-icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">

    <!-- 提前应用夜间模式，避免页面闪动 -->
    <script src="../assets/js/theme-init.js"></script>

    <link rel="stylesheet" href="../assets/css/style.css">
    <link rel="stylesheet" href="../assets/css/components.css">
    <link rel="stylesheet" href="../assets/css/v8-components.css">
    <!-- Mermaid 流程图。
         注意：mermaid 的实际配置由 assets/js/mermaid-init.js 里的
         mermaid.initialize() 决定（v10 不读 window.mermaidConfig）。
         这里不直接引 mermaid 脚本，改由 init 脚本按需加载，
         避免 mermaid 在页面刚打开、字体未就绪时就抢先渲染一遍。 -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>

    <link rel="stylesheet" href="../assets/css/guide.css">
    <link rel="stylesheet" href="../assets/css/touch-feedback.css">

</head>

<body>

    <header class="navbar">
        <a href="../index.html" class="logo-gsh">GSH</a>
        <div class="navbar-actions">
            <a href="../index.html" class="back-btn">返回首页</a>
            <button id="theme-toggle" type="button">🌙</button>
        </div>
    </header>

    <section class="page-header">
        <h1>@@TITLE@@</h1>
        <p>@@DESC@@</p>
    </section>

    <main class="guide-main">
@@BODY@@
    </main>

    <footer class="footer">
        <p>工学部研究生事务服务中心 © 2026</p>
        <p class="footer-note">本站只整理流程与材料说明，不受理申请、不审批、不发布通知。当年的日期、名额、金额以学校与学院官方通知为准。</p>
    </footer>

    <script src="../assets/js/theme.js?v=@@VER@@"></script>
    <script src="../assets/js/mermaid-init.js?v=@@VER@@"></script>
</body>
</html>
"""


def render_page(title, desc, body):
    """把模板占位符替换掉"""
    html = PAGE_TEMPLATE
    html = html.replace("@@TITLE@@", title)
    html = html.replace("@@DESC@@", desc)
    html = html.replace("@@BODY@@", body)
    # 资源版本号：改过 JS/CSS 后浏览器会强制取新文件，避免缓存旧版本
    ver = str(int(time.time()))
    html = html.replace("@@VER@@", ver)
    return html


# ==========================================================
# 工具函数
# ==========================================================
def read_text(path):
    """兼容 utf-8 / gbk 编码读取"""
    with io.open(path, "rb") as f:
        raw = f.read()
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb18030"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def escape_html(text):
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def slugify(text):
    """生成锚点 id：保留中文，去掉标点"""
    s = re.sub(r"[^\w\u4e00-\u9fff\s-]", "", text.strip())
    s = re.sub(r"\s+", "-", s)
    return s.lower()


# ==========================================================
# 行内解析
# ==========================================================
def parse_inline(text):
    """
    解析行内 Markdown。

    顺序很重要：先摘出代码 / 图片 / 链接这些「原样保留」的部分，
    再对剩下的纯文本做 HTML 转义，最后做加粗、斜体、占位符替换。
    这样才能正确处理 [文字（含中文括号）](<路径 带空格>) 这种写法。
    """
    stash = []   # 原样保留的 HTML 片段

    def keep(html):
        stash.append(html)
        return "\x00KEEP%d\x00" % (len(stash) - 1)

    # 1. 行内代码
    text = re.sub(
        r"`([^`]+)`",
        lambda m: keep("<code>%s</code>" % escape_html(m.group(1))),
        text,
    )

    # 2. 图片 ![alt](src) —— 必须在链接之前，否则 ! 会被留下
    #    src 可能写成 <路径 带空格>，要正确剥掉尖括号，不能把 > 吃进地址
    def make_img(m):
        src = m.group(2).strip()
        if src.startswith("<") and src.endswith(">"):
            src = src[1:-1]
        return keep(
            '<img src="%s" alt="%s" loading="lazy">'
            % (escape_html(src), escape_html(m.group(1)))
        )

    text = re.sub(r"!\[([^\]]*)\]\((<[^>]*>|[^)\s]*)\)", make_img, text)

    # 3. 链接 [文字](地址)
    #    - 带尖括号包裹的路径（路径含空格时 md 规范要求这样写）
    #    - 不带尖括号的普通地址
    #    链接要放进 stash，否则后面的 escape_html 会把生成的 <a> 也转义掉
    def make_link(m):
        label = escape_html(m.group(1))
        href = m.group(2).strip()
        if href.startswith("<") and href.endswith(">"):
            href = href[1:-1]
        href = escape_html(href)
        if href.startswith(("http://", "https://")):
            return keep(
                '<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>'
                % (href, label)
            )
        return keep('<a class="internal-link" href="%s">%s</a>' % (href, label))

    text = re.sub(r"\[(.+?)\]\(<([^>]+)>\)", make_link, text)
    text = re.sub(r"\[([^\]\n]+?)\]\(([^()\s]+)\)", make_link, text)

    # 4. 剩下的都是纯文本，做 HTML 转义
    text = escape_html(text)

    # 5. 加粗 / 斜体
    text = re.sub(r"\*\*\*([^*]+)\*\*\*", r"<strong><em>\1</em></strong>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", text)

    # 6. 待填写占位符
    text = text.replace("【　】", '<span class="todo-placeholder">【待填写】</span>')
    text = text.replace("【】", '<span class="todo-placeholder">【待填写】</span>')
    text = re.sub(
        r"【([^】]{0,40}?)】",
        lambda m: '<span class="todo-placeholder">【%s】</span>' % m.group(1),
        text,
    )

    # 7. 还原原样保留的片段
    for i, html in enumerate(stash):
        text = text.replace("\x00KEEP%d\x00" % i, html)

    return text


# ==========================================================
# 块级解析
# ==========================================================
def split_table_row(line):
    cells = line.strip().strip("|").split("|")
    return [c.strip() for c in cells]


def is_table_sep(line):
    stripped = line.strip()
    if not stripped.startswith("|"):
        return False
    cells = split_table_row(stripped)
    if not cells:
        return False
    return all(re.match(r"^:?-{2,}:?$", c.replace(" ", "")) for c in cells if c != "")


def convert(text):
    """把 Markdown 正文转成 HTML 片段"""
    text = text.replace("\r\n", "\n")

    lines = text.split("\n")
    html = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # 代码块
        if stripped.startswith("```"):
            lang = stripped[3:].strip()
            i += 1
            code_lines = []
            while i < n and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            code = "\n".join(code_lines)
            if lang.lower() == "mermaid":
                # 源码放在 <template> 里，不会被浏览器解析成标签。
                # 注意：<pre> 的 class 不能叫 mermaid ——
                # mermaid 脚本加载时会自动扫描所有 .mermaid 元素并用默认配置渲染，
                # 那次渲染的节点宽度会算错（被压成 14px），
                # 而且会打上 data-processed 标记，导致我们自己后续的渲染被跳过。
                # 所以用别的类名，等我们自己配置好再渲染。
                html.append(
                    '<div class="mermaid-block">'
                    '<template class="mermaid-source">%s</template>'
                    '<pre class="mermaid-pre"></pre>'
                    "</div>" % escape_html(code)
                )
            else:
                html.append(
                    '<pre class="code-block"><code>%s</code></pre>' % escape_html(code)
                )
            continue

        # 表格
        if stripped.startswith("|") and i + 1 < n and is_table_sep(lines[i + 1]):
            header = split_table_row(stripped)
            i += 2
            body_rows = []
            while i < n and lines[i].strip().startswith("|"):
                body_rows.append(split_table_row(lines[i].strip()))
                i += 1
            out = ['<div class="table-wrap"><table><thead><tr>']
            for c in header:
                out.append("<th>%s</th>" % parse_inline(c))
            out.append("</tr></thead><tbody>")
            for row in body_rows:
                out.append("<tr>")
                for c in row:
                    out.append("<td>%s</td>" % parse_inline(c))
                out.append("</tr>")
            out.append("</tbody></table></div>")
            html.append("".join(out))
            continue

        # 分隔线
        if stripped in ("---", "***", "___"):
            html.append("<hr>")
            i += 1
            continue

        # 引用块
        if stripped.startswith(">"):
            quote_lines = []
            while i < n and lines[i].strip().startswith(">"):
                quote_lines.append(lines[i].strip()[1:].strip())
                i += 1
            inner = convert("\n".join(quote_lines))
            html.append('<blockquote class="guide-quote">%s</blockquote>' % inner)
            continue

        # 标题
        m = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text_title = m.group(2).strip()
            anchor = slugify(text_title)
            parsed = parse_inline(text_title)
            if level == 1:
                # 一级标题作为页面大标题，不重复输出
                i += 1
                continue
            html.append(
                '<h%d id="%s">%s<a class="anchor-link" href="#%s" aria-label="链接到此">#</a></h%d>'
                % (level, anchor, parsed, anchor, level)
            )
            i += 1
            continue

        # 无序列表
        if re.match(r"^[-*+]\s+", stripped):
            items = []
            while i < n:
                cur = lines[i].strip()
                if not cur:
                    if i + 1 < n and re.match(r"^([-*+]|\d+[.)])\s+", lines[i + 1].strip()):
                        i += 1
                        continue
                    break
                m2 = re.match(r"^[-*+]\s+(.*)$", cur)
                if m2:
                    items.append([m2.group(1)])
                elif items:
                    items[-1].append(cur)
                else:
                    break
                i += 1
            html.append("<ul>" + "".join(
                "<li>%s</li>" % parse_inline(" ".join(it)) for it in items
            ) + "</ul>")
            continue

        # 有序列表
        if re.match(r"^\d+[.)]\s+", stripped):
            items = []
            while i < n:
                cur = lines[i].strip()
                if not cur:
                    if i + 1 < n and re.match(r"^([-*+]|\d+[.)])\s+", lines[i + 1].strip()):
                        i += 1
                        continue
                    break
                m2 = re.match(r"^\d+[.)]\s+(.*)$", cur)
                if m2:
                    items.append([m2.group(1)])
                elif items:
                    items[-1].append(cur)
                else:
                    break
                i += 1
            html.append("<ol>" + "".join(
                "<li>%s</li>" % parse_inline(" ".join(it)) for it in items
            ) + "</ol>")
            continue

        # 段落
        para = []
        while i < n and lines[i].strip():
            cur = lines[i].strip()
            if cur.startswith(("#", ">", "|", "```")) or re.match(r"^([-*+]|\d+[.)])\s+", cur):
                break
            para.append(cur)
            i += 1
        if para:
            html.append("<p>%s</p>" % parse_inline(" ".join(para)))

    return "\n".join(html)


# ==========================================================
# 单文件转换入口
# ==========================================================
def build(src, dst, title=None, desc=None):
    raw = read_text(src)

    m = re.search(r"^#\s+(.+)$", raw, re.M)
    md_title = m.group(1).strip() if m else os.path.basename(src)

    desc_text = desc or ""
    if not desc_text:
        for ln in raw.split("\n"):
            s = ln.strip()
            if s and not s.startswith(("#", ">", "|", "```", "-", "*")) and "【　】" not in s:
                desc_text = re.sub(r"[*`]", "", s)
                desc_text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", desc_text)
                break

    body = convert(raw)
    html = render_page(escape_html(title or md_title), escape_html(desc_text), body)

    with io.open(dst, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    return len(body)


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__)
        return

    src = args[0]
    dst = args[1]
    title = args[args.index("--title") + 1] if "--title" in args else None
    desc = args[args.index("--desc") + 1] if "--desc" in args else None

    size = build(src, dst, title, desc)
    print("OK %s -> %s (%d chars body)" % (src, dst, size))


if __name__ == "__main__":
    main()
