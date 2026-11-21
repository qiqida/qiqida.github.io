# -*- coding: utf-8 -*-
"""
seo.py —— 生成站点 SEO 相关文件

产出：
  1. sitemap.xml   —— 给搜索引擎的页面清单
  2. robots.txt    —— 告诉搜索引擎怎么抓
  3. 404.html      —— 用户访问不存在的地址时看到的友好页面
                   （GitHub Pages 支持根目录下的 404.html）

运行：
    python 网站改版2/tools/seo.py
"""
import io
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "网站改版2")
OUT = SRC
PAGES = os.path.join(OUT, "pages")

SITE_BASE = "https://qiqida.github.io"

# 站点根目录下的额外文件（不是 pages/ 里的页面）
EXTRA_FILES = ["index.html"]


def collect_pages():
    """返回 [(相对路径, lastmod时间戳字符串), ...]"""
    out = []
    if not os.path.isdir(PAGES):
        return out

    for fn in sorted(os.listdir(PAGES)):
        if not fn.endswith(".html"):
            continue
        # 跳转页不进 sitemap
        path = os.path.join(PAGES, fn)
        with io.open(path, "r", encoding="utf-8") as f:
            head = f.read(2000)
        if 'http-equiv="refresh"' in head:
            continue
        mtime = time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(path)))
        out.append(("pages/%s" % fn, mtime))

    idx = os.path.join(OUT, "index.html")
    if os.path.exists(idx):
        mtime = time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(idx)))
        out.insert(0, ("index.html", mtime))

    return out


def write_sitemap(paths):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for rel, mtime in paths:
        lines.append("  <url>")
        lines.append("    <loc>%s/%s</loc>" % (SITE_BASE, rel))
        lines.append("    <lastmod>%s</lastmod>" % mtime)
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")

    path = os.path.join(OUT, "sitemap.xml")
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(lines))
    print("wrote: sitemap.xml（%d 个页面）" % len(paths))


def write_robots():
    text = """User-agent: *
Allow: /

# 不收录预览目录与内部构建产物
Disallow: /网站改版2/
Disallow: /网站改版/

Sitemap: %s/sitemap.xml
""" % SITE_BASE

    path = os.path.join(OUT, "robots.txt")
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("wrote: robots.txt")


NOT_FOUND_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>页面不存在 | 工学部研究生事务服务中心</title>
    <meta name="robots" content="noindex">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f5f5f7;
            color: #1d1d1f;
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        }
        .box {
            max-width: 520px;
            width: 100%;
            padding: 40px 32px;
            border-radius: 20px;
            background: #fff;
            border: 1px solid #e5e5ea;
            text-align: center;
        }
        .code {
            font-size: 56px;
            font-weight: 700;
            letter-spacing: 0.05em;
            color: #0071e3;
            margin: 0 0 8px;
        }
        h1 { font-size: 20px; margin: 0 0 12px; }
        p { font-size: 15px; line-height: 1.8; color: #6e6e73; margin: 0 0 24px; }
        .links { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .links a {
            display: inline-block;
            padding: 10px 18px;
            border-radius: 999px;
            background: rgba(0, 113, 227, 0.08);
            color: #0071e3;
            font-size: 14px;
            text-decoration: none;
        }
        .links a:hover { background: rgba(0, 113, 227, 0.16); }
        .home { background: #0071e3; color: #fff; }
        .home:hover { background: #0062cc; }
    </style>
</head>
<body>
    <div class="box">
        <p class="code">404</p>
        <h1>这个页面不在了</h1>
        <p>你打开的地址可能已经调整、拼写有误，或者内容被合并到别的页面。<br>
           试试用下面的入口，或者回首页用搜索框搜你想办的事。</p>
        <div class="links">
            <a class="home" href="./">回首页</a>
            <a href="./pages/study.html">学习专区</a>
            <a href="./pages/aid.html">奖助专区</a>
            <a href="./pages/life.html">生活与证件</a>
            <a href="./pages/faq.html">问题专区</a>
        </div>
    </div>
</body>
</html>
"""


def write_404():
    path = os.path.join(OUT, "404.html")
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(NOT_FOUND_HTML)
    print("wrote: 404.html")


def main():
    if not os.path.isdir(PAGES):
        print("还没有 pages/ 目录，请先运行 build.py")
        return
    paths = collect_pages()
    write_sitemap(paths)
    write_robots()
    write_404()


if __name__ == "__main__":
    main()
