# -*- coding: utf-8 -*-
"""
md2html.py —— Markdown → 静态 HTML（构建期一次性运行）

与「网站改版」版的差异
--------------------
1. 支持 front-matter（标题 / 简介 / 专区 / 锚点 / 关键词），从 siteconf 读取。
2. **附件链接按文件名自动匹配**：md 里写 `[请假条](<请假条申请表（空表） 电院.doc>)`，
   构建时按文件名在 files/ 里找到真实路径，改写成 `../files/<分类>/<文件名>`。
   找不到时保留原样并在构建日志里报警告，不会静默失败。
3. 页面模板支持「专区总览」与「子板块详情」两种形态：
   - 子板块页：带面包屑、上一/下一块导航
   - 专区总览页：列出该专区全部子板块的卡片

用法：
    python md2html.py <输入.md> <输出.html> --title "页面标题"
"""
import io
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import escape_html, parse_front_matter, read_text, slugify  # noqa: E402

# 站点根地址。用于生成 canonical / og:url 等绝对地址。
# 站点部署在 GitHub Pages 的 qiqida.github.io 根域名下，所以就是域名本身。
SITE_BASE = "https://qiqida.github.io"

# Google Analytics 测量 ID。构建时从 data/site-config.json 读取，
# 读取不到就用这个默认值。
DEFAULT_GA_ID = "G-2S0K5DDSME"

# 资源版本号。一次构建内所有页面共用同一个值，
# 保证 index.html 和 pages/*.html 引用的是同一批资源。
# 用途：JS / CSS 标签带 ?v=<版本号>，改过内容后浏览器强制取新文件。
#
# make.py 会把版本号放进环境变量 SITE_VER，
# 这样各个独立进程用的是同一个值（否则每个脚本各算一次，可能差 1 秒）。
SITE_VER = os.environ.get("SITE_VER") or str(int(time.time()))


def load_ga_id():
    """从 data/site-config.json 读 gaId，读不到用默认值。"""
    import json
    here = os.path.dirname(os.path.abspath(__file__))
    cfg = os.path.join(here, "..", "data", "site-config.json")
    try:
        with io.open(cfg, "r", encoding="utf-8") as f:
            return (json.load(f) or {}).get("gaId") or DEFAULT_GA_ID
    except Exception:
        return DEFAULT_GA_ID


# ==========================================================
# 主题切换开关（首页和子页面共用同一份结构）
# ==========================================================
# 为什么用 SVG 而不是 emoji：
#   · emoji 在 Windows / macOS / iOS / Android 上渲染差异很大，
#     形状、颜色、对齐基线都不统一
#   · emoji 无法做双色调（太阳该是暖黄、月亮该是冷白）
#   · SVG 可以精确控制笔画粗细和比例，跨系统完全一致
#
# 结构：
#   button.theme-switch            —— 开关本体，负责可点击区域和无障碍语义
#     └ span.theme-switch-track    —— 胶囊轨道，宽度随主题变化
#         └ span.theme-switch-thumb —— 圆形滑块，位置上带日月图标
#
# 注意：JS 不能用 textContent 改这个按钮（会把 SVG 结构清空），
# 只能改 html[data-theme] 和 aria-checked，动画全部由 CSS 负责。
THEME_SWITCH_HTML = """<button id="theme-toggle" class="theme-switch" type="button" role="switch" aria-checked="false" aria-label="切换深色模式">
                <span class="theme-switch-track">
                    <span class="theme-switch-thumb">
                        <span class="theme-switch-icon theme-switch-icon-sun" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <circle cx="12" cy="12" r="4.2"></circle>
                                <path d="M12 2.4v2.2M12 19.4v2.2M4.2 12H2M22 12h-2.2M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6"></path>
                            </svg>
                        </span>
                        <span class="theme-switch-icon theme-switch-icon-moon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"></path>
                            </svg>
                        </span>
                    </span>
                </span>
            </button>"""

# ==========================================================
# 页面模板
# 用 @@占位符@@ 而不是 str.format，避免与模板里的 JS 花括号冲突
# ==========================================================
PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">

<script async src="https://www.googletagmanager.com/gtag/js?id=@@GAID@@"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', '@@GAID@@');
</script>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@@TITLE@@ | 工学部研究生事务服务中心</title>
    <meta name="description" content="@@DESC@@">
    <meta name="keywords" content="@@KEYWORDS@@">

    <!-- 分享卡片（微信 / QQ / 微博 转发时显示标题与摘要） -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="工学部研究生事务服务中心">
    <meta property="og:title" content="@@TITLE@@ | 工学部研究生事务服务中心">
    <meta property="og:description" content="@@DESC@@">
    <meta property="og:url" content="@@CANONICAL@@">
    <meta property="og:locale" content="zh_CN">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="@@TITLE@@ | 工学部研究生事务服务中心">
    <meta name="twitter:description" content="@@DESC@@">

    <!-- 规范地址，避免搜索引擎把带参数的链接当成重复内容 -->
    <link rel="canonical" href="@@CANONICAL@@">

    <!-- Favicon 图标 -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">
    <link rel="apple-touch-icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">

    <!-- 提前应用夜间模式，避免页面闪动 -->
    <script src="../assets/js/theme-init.js"></script>

    <!-- 全站资源版本号。
         JS 里 fetch 数据文件时统一用 SITE_VER 拼 ?v=，
         这样内容更新后浏览器不会拿旧的 JSON 缓存。 -->
    <script>window.SITE_VER = "@@VER@@";</script>

    <link rel="stylesheet" href="../assets/css/style.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/components.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/v8-components.css?v=@@VER@@">
    <!-- Mermaid 流程图。
         只有页面里真的有 mermaid 代码块时，构建脚本才会把下面这行替换成
         真正的 CDN 地址；没有流程图的页面完全不会下载这 1MB 的库。
         实际配置由 assets/js/mermaid-init.js 里的 mermaid.initialize() 决定。 -->
@@MERMAID@@

    <link rel="stylesheet" href="../assets/css/guide.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/touch-feedback.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/subpage.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/theme-switch.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/a11y.css?v=@@VER@@">
@@EXTRACSS@@

</head>

<body id="page-top" data-root="..">

    <!-- 键盘用户按 Tab 第一下就能跳到正文 -->
    <a class="skip-to-content" href="#main-content">跳到正文</a>

    <!-- ==========================================================
         吸顶头部：导航栏 + 搜索条

         和首页用的是同一套结构（.header-stack），
         所以子页面的导航栏和搜索框也会一起吸在页面顶部，
         滚动时搜索框始终停在导航栏正下方，不会被内容盖住。

         data-root=".." 告诉 search.js 本页在站点根的下一层，
         数据文件和跳转链接都要往上退一级。
         ========================================================== -->
    <div class="header-stack">
        <header class="navbar">
            <a href="../index.html" class="logo-gsh">GSH</a>
            <div class="navbar-actions">
                <a href="../index.html" class="back-btn">返回首页</a>
                @@THEME_SWITCH@@
            </div>
        </header>

        <!-- 桌面端搜索条：吸在导航栏下方 -->
        <div class="search-bar-wrapper desktop-search">
            <div class="search-bar-inner">
                <input type="text" id="global-search-desktop" class="search-box" placeholder="搜索请假、奖学金、毕业登记表..." aria-label="站内搜索">
                <div id="search-suggestions-desktop"></div>
            </div>
        </div>

        <!-- 手机端搜索条：吸在导航栏下方 -->
        <div class="mobile-search" id="mobile-search-container">
            <div class="search-bar-wrapper">
                <input type="text" id="global-search" class="search-box" placeholder="搜索请假、奖学金、毕业登记表..." aria-label="站内搜索">
                <div id="search-suggestions"></div>
            </div>
        </div>
    </div>

    <section class="page-header">
        @@BREADCRUMB@@
        <h1>@@TITLE@@</h1>
        <p>@@DESC@@</p>
    </section>

    <main class="guide-main" id="main-content">
@@BODY@@
    </main>

    @@PAGENAV@@

    @@BACKBTN@@

    <footer class="footer">
        <p>工学部研究生事务服务中心 © 2026</p>
        <p class="footer-note">本站只整理流程与材料说明，不受理申请、不审批、不发布通知。当年的日期、名额、金额以学校与学院官方通知为准。</p>
    </footer>

    <script src="../assets/js/theme.js?v=@@VER@@"></script>
    <script src="../assets/js/header-height.js?v=@@VER@@"></script>
    <script src="../assets/js/search.js?v=@@VER@@"></script>
    <script src="../assets/js/mermaid-init.js?v=@@VER@@"></script>
@@EXTRAJS@@
</body>
</html>
"""


def render_page(title, desc, body, breadcrumb="", pagenav="", backbtn="",
                url_path="", keywords="", extra_css="", extra_js=""):
    """
    把模板占位符替换掉。

    url_path —— 该页在站点根目录下的相对路径，如 "pages/study-leave.html"，
                用于生成 canonical / og:url。留空则不生成绝对地址。
    keywords —— 页面关键词，逗号分隔，填进 <meta name="keywords">。
    """
    html = PAGE_TEMPLATE
    html = html.replace("@@TITLE@@", title)
    html = html.replace("@@DESC@@", desc)
    html = html.replace("@@BODY@@", body)
    html = html.replace("@@BREADCRUMB@@", breadcrumb)
    html = html.replace("@@PAGENAV@@", pagenav)
    html = html.replace("@@BACKBTN@@", backbtn)

    # 关键词
    html = html.replace("@@KEYWORDS@@", keywords or "")

    # 页面按需追加的 CSS / JS
    html = html.replace("@@EXTRACSS@@", extra_css or "")
    html = html.replace("@@EXTRAJS@@", extra_js or "")

    # 规范地址（canonical / og:url）
    # 站点部署在 GitHub Pages 子路径下时，相对路径同样有效，
    # 这里用绝对地址，搜索引擎收录效果更好。
    if url_path:
        html = html.replace("@@CANONICAL@@", "%s/%s" % (SITE_BASE.rstrip("/"), url_path.lstrip("/")))
    else:
        html = html.replace("@@CANONICAL@@", SITE_BASE.rstrip("/") + "/")

    # GA 测量 ID
    html = html.replace("@@GAID@@", load_ga_id())

    # Mermaid 按需加载：只有页面里真的有 mermaid 代码块才引 CDN（约 1MB）。
    # 没有流程图的页面不下载，首屏明显更快；国内 CDN 不稳时影响面也小很多。
    if 'class="mermaid-source"' in html:
        html = html.replace(
            "@@MERMAID@@",
            '<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"'
            ' onerror="window.__mermaidLoadFailed=true"></script>',
        )
    else:
        html = html.replace("@@MERMAID@@", "")

    # 资源版本号：改过 JS/CSS 后浏览器会强制取新文件，避免缓存旧版本。
    # 用模块级常量，保证一次构建里所有页面的版本号一致。
    html = html.replace("@@VER@@", SITE_VER)

    # 主题切换开关（首页和子页面共用同一份结构）
    html = html.replace("@@THEME_SWITCH@@", THEME_SWITCH_HTML)
    return html


# ==========================================================
# 附件链接：按文件名自动匹配真实路径
# ==========================================================
ATTACH_INDEX = {}     # 文件名 -> 站点相对路径（不含前缀）
ATTACH_WARNINGS = []  # 匹配失败的记录


def build_attachment_index(files_dir=None):
    """
    扫描附件源目录，建立「文件名 → 站点路径」索引。

    站点路径形如 files/leave/请假条申请表（空表） 电院.doc

    注意：这里直接扫**源目录**（内容/08_文件专区/附件/），
    而不是 files/ —— 因为 build.py 比 assets.py 先跑，
    扫 files/ 那时它还是空的。
    """
    from siteconf import ATT_SRC

    # 源目录名 → 站点短名
    cat_map = {
        "01_请假条与报备单": "leave",
        "02_申请表与审批表": "forms",
        "03_证明与协议模板": "proof",
        "04_申请书与总结模板": "apply",
        "05_说明与截图归档": "archive",
    }

    index = {}
    if not os.path.isdir(ATT_SRC):
        return index

    for dirpath, _dirnames, filenames in os.walk(ATT_SRC):
        rel_dir = os.path.relpath(dirpath, ATT_SRC).replace("\\", "/")
        short = cat_map.get(rel_dir)
        if short is None:
            continue
        for fn in filenames:
            if fn.lower().endswith(".md"):
                continue
            index.setdefault(fn, "files/%s/%s" % (short, fn))
    return index


def resolve_attachment(href, index, page_dir="pages"):
    """
    把 md 里的附件链接解析成站点里的真实路径。

    已经是站点路径（files/...）的保持不变；
    纯文件名的按索引查找。
    """
    if not href:
        return href
    if href.startswith(("http://", "https://", "#", "mailto:")):
        return href
    if "/" in href or "\\" in href:
        return href

    target = index.get(href)
    if target:
        return "../" + target if page_dir == "pages" else target

    ATTACH_WARNINGS.append(href)
    return href


# ==========================================================
# 行内解析
# ==========================================================
def parse_inline(text, attach_index=None, page_dir="pages"):
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
    def make_img(m):
        src = m.group(2).strip()
        if src.startswith("<") and src.endswith(">"):
            src = src[1:-1]
        if attach_index is not None:
            src = resolve_attachment(src, attach_index, page_dir)
        return keep(
            '<img src="%s" alt="%s" loading="lazy">'
            % (escape_html(src), escape_html(m.group(1)))
        )

    text = re.sub(r"!\[([^\]]*)\]\((<[^>]*>|[^)\s]*)\)", make_img, text)

    # 3. 链接 [文字](地址)
    def make_link(m):
        label = escape_html(m.group(1))
        href = m.group(2).strip()
        if href.startswith("<") and href.endswith(">"):
            href = href[1:-1]
        if attach_index is not None:
            href = resolve_attachment(href, attach_index, page_dir)
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


def convert(text, attach_index=None, page_dir="pages"):
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
                # <pre> 的 class 不能叫 mermaid —— mermaid 脚本加载时会自动扫描
                # 所有 .mermaid 元素并用默认配置渲染，那次渲染的节点宽度会算错，
                # 而且会打上 data-processed 标记，导致我们自己后续的渲染被跳过。
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
                out.append("<th>%s</th>" % parse_inline(c, attach_index, page_dir))
            out.append("</tr></thead><tbody>")
            for row in body_rows:
                out.append("<tr>")
                for c in row:
                    out.append("<td>%s</td>" % parse_inline(c, attach_index, page_dir))
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
            inner = convert("\n".join(quote_lines), attach_index, page_dir)
            html.append('<blockquote class="guide-quote">%s</blockquote>' % inner)
            continue

        # 标题
        m = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text_title = m.group(2).strip()
            anchor = slugify(text_title)
            parsed = parse_inline(text_title, attach_index, page_dir)
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
                "<li>%s</li>" % parse_inline(" ".join(it), attach_index, page_dir)
                for it in items
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
                "<li>%s</li>" % parse_inline(" ".join(it), attach_index, page_dir)
                for it in items
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
            html.append("<p>%s</p>" % parse_inline(" ".join(para), attach_index, page_dir))

    return "\n".join(html)


# ==========================================================
# 单文件转换入口
# ==========================================================
def build(src, dst, title=None, desc=None, attach_index=None):
    raw = read_text(src)
    meta, body = parse_front_matter(raw)

    m = re.search(r"^#\s+(.+)$", body, re.M)
    md_title = m.group(1).strip() if m else os.path.basename(src)

    desc_text = desc or meta.get("desc", "")
    if not desc_text:
        for ln in body.split("\n"):
            s = ln.strip()
            if s and not s.startswith(("#", ">", "|", "```", "-", "*")) and "【　】" not in s:
                desc_text = re.sub(r"[*`]", "", s)
                desc_text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", desc_text)
                break

    body_html = convert(body, attach_index)
    html = render_page(
        escape_html(title or meta.get("title") or md_title),
        escape_html(desc_text),
        body_html,
    )

    with io.open(dst, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    return len(body_html)


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
