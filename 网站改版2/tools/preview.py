# -*- coding: utf-8 -*-
"""
preview.py —— 把「网站改版2」的内容生成独立预览站点

只做一件事：在「网站改版2/_preview/」生成一份自包含的静态站点，
用浏览器打开 _preview/index.html 即可查看效果。
**不会修改站点根目录的任何文件。**

用法：
    python 网站改版2/tools/preview.py
"""
import io
import os
import re
import shutil
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "网站改版2")
PREVIEW = os.path.join(SRC, "_preview")

# 旧站点页面 → 新页面 的跳转映射
REDIRECTS = {
    "leave.html": "study-leave.html",
    "internship.html": "career-internship.html",
    "graduation.html": "career-degree.html",
    "other.html": "life.html",
    "notices.html": "about-disclaimer.html",
    "notice.html": "notice-2026100.html",
}

REDIRECT_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>页面已迁移 | 工学部研究生事务服务中心</title>
    <meta http-equiv="refresh" content="0; url=@@TARGET@@">
    <script>window.location.replace("@@TARGET@@");</script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; margin: 0; background: #f5f5f7; color: #1d1d1f;
        }
        .box { text-align: center; padding: 24px; }
        .box a { color: #0071e3; }
    </style>
</head>
<body>
    <div class="box">
        <p>页面已调整，正在跳转…</p>
        <p><a href="@@TARGET@@">点这里直接前往</a></p>
    </div>
</body>
</html>
"""

# ==========================================================
# 预览缓存穿透
#
# 问题：浏览器会缓存 HTML 页面本身。构建脚本给 JS/CSS 加了 ?v=版本号，
#      但 HTML 不会被强刷，导致「改完结构刷新后还是老样子」。
#
# 方案：给预览站点里每个 HTML 注入一小段脚本，
#      点击站内链接时自动追加 ?v=版本号，强制浏览器重新取页面。
#      只作用于 _preview/ 预览目录，不影响正式站点。
# ==========================================================
PREVIEW_VER_JS = """<script>
/* 预览缓存穿透：站内链接自动带版本号，避免看到旧页面 */
(function () {
    var V = "@@VER@@";
    function findAnchor(node) {
        while (node && node !== document) {
            if (node.tagName === "A" && node.getAttribute("href")) return node;
            node = node.parentNode;
        }
        return null;
    }
    document.addEventListener("click", function (e) {
        var a = findAnchor(e.target);
        if (!a) return;
        var href = a.getAttribute("href");
        if (!href) return;
        if (href.charAt(0) === "#") return;          /* 页内锚点 */
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return; /* http/mailto 等绝对地址 */
        /* 去掉可能已存在的 v= 参数，再统一追加 */
        href = href.replace(/([?&])v=[^&]*/, "$1").replace(/[?&]$/, "");
        var sep = href.indexOf("?") >= 0 ? "&" : "?";
        a.setAttribute("href", href + sep + "v=" + V);
    }, true);
})();
</script>
"""


def file_hash(path):
    import hashlib
    with io.open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def copy_tree(src, dst):
    """复制目录，跳过内容相同的文件"""
    if not os.path.isdir(src):
        return 0
    count = 0
    for dirpath, _dirnames, filenames in os.walk(src):
        rel = os.path.relpath(dirpath, src)
        target_dir = os.path.join(dst, rel) if rel != "." else dst
        if not os.path.isdir(target_dir):
            os.makedirs(target_dir)
        for fn in filenames:
            s = os.path.join(dirpath, fn)
            d = os.path.join(target_dir, fn)
            if os.path.exists(d) and file_hash(s) == file_hash(d):
                continue
            shutil.copy2(s, d)
            count += 1
    return count


def write_redirects(pages_dir):
    for old, target in REDIRECTS.items():
        path = os.path.join(pages_dir, old)
        html = REDIRECT_TEMPLATE.replace("@@TARGET@@", target)
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(html)
    print("生成跳转页 %d 个" % len(REDIRECTS))


def inject_cache_buster(root, ver):
    """
    给预览站点里所有 HTML 注入缓存穿透脚本。

    浏览器缓存的是 HTML 本身，JS/CSS 上的 ?v= 参数管不到它。
    这里给每个页面塞一段脚本，点站内链接时自动追加 ?v=版本号，
    保证每次构建后预览到的都是新页面。
    """
    count = 0
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            if not fn.endswith(".html"):
                continue
            path = os.path.join(dirpath, fn)
            with io.open(path, "r", encoding="utf-8", newline="") as f:
                html = f.read()
            if "预览缓存穿透" in html:
                continue
            # 插到 </head> 之前；没有 </head> 就插到 <body> 之后
            script = PREVIEW_VER_JS.replace("@@VER@@", ver)
            if "</head>" in html:
                html = html.replace("</head>", script + "</head>", 1)
            elif "<body" in html:
                idx = html.index(">") + 1
                html = html[:idx] + "\n" + script + html[idx:]
            else:
                html = script + html
            with io.open(path, "w", encoding="utf-8", newline="") as f:
                f.write(html)
            count += 1
    return count


def build():
    # 注意：只删 _preview 自己的目录，绝对不能删 SRC 整个目录
    if os.path.isdir(PREVIEW):
        shutil.rmtree(PREVIEW)
    os.makedirs(PREVIEW)

    n = 0
    for sub in ("pages", "data", "files", "notices", "assets"):
        n += copy_tree(os.path.join(SRC, sub), os.path.join(PREVIEW, sub))

    shutil.copy2(os.path.join(SRC, "index.html"), os.path.join(PREVIEW, "index.html"))
    n += 1

    # 根目录下的 SEO / 辅助文件
    for extra in ("sitemap.xml", "robots.txt", "404.html"):
        p = os.path.join(SRC, extra)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(PREVIEW, extra))
            n += 1

    write_redirects(os.path.join(PREVIEW, "pages"))

    # 版本号 = 本次构建的时间戳，每次构建都不同
    ver = str(int(time.time()))
    injected = inject_cache_buster(PREVIEW, ver)

    print("预览已生成: 网站改版2/_preview/  （%d 个文件）" % n)
    print("已给 %d 个页面注入缓存穿透（v=%s）" % (injected, ver))
    print("用浏览器打开 _preview/index.html 即可查看效果")
    print("提示：站点根目录的文件没有被改动。")


if __name__ == "__main__":
    build()
