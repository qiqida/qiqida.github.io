# -*- coding: utf-8 -*-
"""
notices.py —— 生成通知详情页

把 notices/*.md 转成 pages/notice-<id>.html，
首页「重要通知」区块点击后直接进入对应详情页。

运行：
    python 网站改版2/tools/notices.py
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from siteconf import DATA, OUT, escape_html, read_text  # noqa: E402
from md2html import convert, render_page  # noqa: E402

NOTICES_DIR = os.path.join(OUT, "notices")
PAGES = os.path.join(OUT, "pages")


def build():
    if not os.path.isdir(NOTICES_DIR):
        print("没有 notices/ 目录，跳过")
        return

    notices_json = os.path.join(DATA, "notices.json")
    if not os.path.exists(notices_json):
        print("没有 data/notices.json，跳过")
        return

    with io.open(notices_json, "r", encoding="utf-8") as f:
        notices = json.load(f)

    built = []

    for n in notices:
        md_rel = n.get("markdown", "")
        if not md_rel:
            continue
        src = os.path.join(OUT, md_rel.replace("/", os.sep))
        if not os.path.exists(src):
            print("  [警告] 找不到通知正文：%s" % md_rel)
            continue

        raw = read_text(src)
        body = convert(raw)

        breadcrumb = """    <nav class="breadcrumb" aria-label="面包屑">
        <a href="../index.html">首页</a>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">重要通知</span>
    </nav>"""

        pagenav = """    <nav class="pagenav" aria-label="页面导航">
        <div class="pagenav-row">
            <span class="pagenav-slot"></span>
            <span class="pagenav-slot"></span>
        </div>
    </nav>"""

        backbtn = """    <a class="back-to-zone" href="../index.html">
        <span class="back-to-zone-arrow" aria-hidden="true">←</span>
        <span class="back-to-zone-text">返回首页</span>
    </a>"""

        html = render_page(
            escape_html(n.get("title", "")),
            escape_html(n.get("summary", "")),
            body,
            breadcrumb=breadcrumb,
            pagenav=pagenav,
            backbtn=backbtn,
            url_path="pages/notice-%s.html" % n["id"],
            keywords="重要通知," + n.get("title", ""),
        )

        out = os.path.join(PAGES, "notice-%s.html" % n["id"])
        with io.open(out, "w", encoding="utf-8", newline="") as f:
            f.write(html)
        built.append(out)

    for p in built:
        print("built:", os.path.relpath(p, OUT))
    print("共生成 %d 个通知详情页" % len(built))


if __name__ == "__main__":
    build()
