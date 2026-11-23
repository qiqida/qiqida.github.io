# -*- coding: utf-8 -*-
"""
build.py —— 「网站改版2」页面构建

产出两种页面：
  1. **子板块详情页**  pages/<zone>-<anchor>.html
     例如 pages/study-leave.html —— 一个子板块一个网页，可单独分享。
  2. **专区总览页**  pages/<zone>.html
     列出该专区下所有子板块的卡片 + 各子板块的摘要。

所有元信息来自 md 的 front-matter（见 siteconf.py），本文件不再硬编码标题和简介。

运行：
    python 网站改版2/tools/build.py
"""
import io
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import (  # noqa: E402
    DATA, FILES, OUT, PAGES, SRC, ZONES, escape_html,
    group_by_zone, scan_content,
)
from md2html import (  # noqa: E402
    ATTACH_WARNINGS, build_attachment_index, convert, render_page,
)
from schema import build_page_ld, render_ld_script  # noqa: E402
from githistory import get_updated_dates  # noqa: E402

# ==========================================================
# 页面片段
# ==========================================================
BREADCRUMB_TEMPLATE = """    <nav class="breadcrumb" aria-label="面包屑">
        <a href="../index.html">首页</a>
        <span class="crumb-sep">/</span>
        <span class="crumb-current">%s</span>
    </nav>
"""

BACKBTN_TEMPLATE = """    <a class="back-to-zone" href="%s">
        <span class="back-to-zone-arrow" aria-hidden="true">←</span>
        <span class="back-to-zone-text">返回%s</span>
    </a>
"""
PAGENAV_TEMPLATE = """    <nav class="pagenav" aria-label="页面导航">
        <div class="pagenav-row">
            %s
            %s
        </div>
    </nav>
"""


def build_breadcrumb(zone, title):
    """面包屑只保留「首页 / 当前专区」，当前页由返回按钮与标题体现"""
    return BREADCRUMB_TEMPLATE % escape_html(zone["title"])


def build_backbtn(zone):
    """子页面顶部的「← 返回专区」按钮"""
    return BACKBTN_TEMPLATE % (
        escape_html("%s.html" % zone["key"]),
        escape_html(zone["title"]),
    )


def build_pagenav(prev_item, next_item):
    """上一个 / 下一个 子板块导航"""
    left = '<span class="pagenav-slot"></span>'
    right = '<span class="pagenav-slot"></span>'

    if prev_item:
        left = (
            '<a class="pagenav-link pagenav-prev" href="%s">'
            '<span class="pagenav-arrow" aria-hidden="true">←</span>'
            '<span class="pagenav-body">'
            '<span class="pagenav-dir">上一个</span>'
            '<span class="pagenav-title">%s</span>'
            '</span>'
            '</a>' % (escape_html(sibling_url(prev_item)), escape_html(prev_item["title"]))
        )
    if next_item:
        right = (
            '<a class="pagenav-link pagenav-next" href="%s">'
            '<span class="pagenav-body">'
            '<span class="pagenav-dir">下一个</span>'
            '<span class="pagenav-title">%s</span>'
            '</span>'
            '<span class="pagenav-arrow" aria-hidden="true">→</span>'
            '</a>' % (escape_html(sibling_url(next_item)), escape_html(next_item["title"]))
        )

    return PAGENAV_TEMPLATE % (left, right)


def sibling_url(item):
    """子页面之间的链接：去掉 pages/ 前缀（都在同一目录）"""
    url = item["url"]
    if url.startswith("pages/"):
        return url[len("pages/"):]
    return url


def build_sublist_cards(items):
    """专区总览页里的子板块卡片"""
    if not items:
        return '<div class="guide-empty">该专区内容正在整理，暂未上线。</div>'

    cards = []
    for it in items:
        # 专区总览页和子页面都在 pages/ 下，同级跳转不加 pages/ 前缀
        url = it["url"]
        if url.startswith("pages/"):
            url = url[len("pages/"):]
        cards.append(
            """            <a class="subcard" href="%s">
                <div class="subcard-body">
                    <h3 class="subcard-title">%s</h3>
                    <p class="subcard-desc">%s</p>
                </div>
                <span class="subcard-arrow" aria-hidden="true">→</span>
            </a>""" % (
                escape_html(url),
                escape_html(it["title"]),
                escape_html(it["desc"] or "　"),
            )
        )
    return '\n'.join(cards)


# ==========================================================
# 页面构建
# ==========================================================
BACKTOP_TEMPLATE = """<p class="back-to-top-link">
    <a href="#page-top">↑ 返回顶部</a>
</p>
"""

# 「最后更新」日期。
#
# 为什么重要：学生最关心的是「这个流程是不是最新的」。
# 显示一个更新日期，比什么都不敢说要可信得多。
# 没有填 updated 字段的页面就不显示（不显示假的）。
UPDATED_TEMPLATE = """<p class="page-updated">最后更新：%s</p>
"""


def build_updated(updated):
    """生成「最后更新」片段，没有日期就返回空串"""
    if not updated:
        return ""
    return UPDATED_TEMPLATE % escape_html(updated)

# 文件专区的附件浏览器骨架。
# 里面的清单由 assets/js/file-browser.js 从 data/downloads.json 读取后渲染，
# 所以这里不用写死文件列表 —— 加了新附件，构建一次就自动出现。
FILE_BROWSER_HTML = """<section class="file-browser" id="file-browser" aria-label="附件浏览器">
    <div class="file-browser-head">
        <h2 class="file-browser-title">全部附件</h2>
        <span class="file-browser-count" id="file-count">正在加载…</span>
    </div>

    <div class="file-search">
        <span class="file-search-icon" aria-hidden="true">🔍</span>
        <input type="search" id="file-search-input"
               placeholder="搜文件名，比如 请假条 / 助学金 / 住宿申请表"
               aria-label="按文件名搜索附件">
    </div>

    <div class="file-filter-row" id="file-cat-filters">
        <span class="file-filter-label">分类</span>
    </div>

    <div class="file-filter-row" id="file-ext-filters">
        <span class="file-filter-label">格式</span>
    </div>

    <ul class="file-list" id="file-list">
        <li class="file-loading">正在加载文件清单…</li>
    </ul>
</section>"""


def build_sub_page(item, attach_index):
    """构建一个子板块的独立页面"""
    body = convert(item["body"], attach_index, "pages")
    # 正文末尾加一个「返回顶部」文字链接
    body += BACKTOP_TEMPLATE
    return body


def build_zone_overview(zone, items, attach_index):
    """构建专区总览页：列出子板块卡片"""
    parts = []
    parts.append('<section class="zone-overview">')
    parts.append('<p class="zone-overview-hint">'
                 '下面是这个专区的 %d 个子板块，点进去看完整流程。</p>' % len(items))
    parts.append('<div class="subcard-grid">')
    parts.append(build_sublist_cards(items))
    parts.append("</div>")
    parts.append("</section>")

    # 文件专区额外挂一个附件浏览器
    if zone and zone.get("key") == "download":
        parts.append(FILE_BROWSER_HTML)

    return "\n".join(parts)


def build_zone_summary(items, attach_index):
    """
    专区总览页正文：先给每块摘要，再给完整正文？

    这里只给卡片列表，正文在各自的子页面里，避免内容重复维护。
    """
    return build_zone_overview(None, items, attach_index)


def main():
    # 清理 pages/
    if os.path.isdir(PAGES):
        shutil.rmtree(PAGES)
    os.makedirs(PAGES)
    if not os.path.isdir(DATA):
        os.makedirs(DATA)
    if not os.path.isdir(FILES):
        os.makedirs(FILES)

    items = scan_content(git_dates=get_updated_dates())
    if not items:
        print("没有找到任何带 front-matter 的内容文件。")
        print("请先运行：python 网站改版2/tools/migrate.py")
        return

    attach_index = build_attachment_index(FILES)
    groups = group_by_zone(items)

    built = []

    # ---- 1. 子板块详情页 ----
    for zone, subs in groups:
        for idx, it in enumerate(subs):
            prev_item = subs[idx - 1] if idx > 0 else None
            next_item = subs[idx + 1] if idx + 1 < len(subs) else None

            body = build_sub_page(it, attach_index)

            url_path = "pages/%s-%s.html" % (it["zone"], it["anchor"])

            # 结构化数据：流程页（HowTo）+ 面包屑 + 问答（FAQPage）
            jsonld = render_ld_script(build_page_ld(
                page_title=it["title"],
                desc=it["desc"],
                url_path=url_path,
                zone_title=zone["title"],
                zone_key=zone["key"],
                body=it["body"],
            ))

            html = render_page(
                escape_html(it["title"]),
                escape_html(it["desc"]),
                body,
                breadcrumb=build_breadcrumb(zone, it["title"]),
                pagenav=build_pagenav(prev_item, next_item),
                backbtn=build_backbtn(zone),
                url_path=url_path,
                keywords=",".join([it["title"]] + list(it["keywords"])),
                jsonld=jsonld,
                updated=build_updated(it.get("updated", "")),
            )
            out = os.path.join(PAGES, "%s-%s.html" % (it["zone"], it["anchor"]))
            with io.open(out, "w", encoding="utf-8", newline="") as f:
                f.write(html)
            built.append(out)

    # ---- 2. 专区总览页 ----
    for zone, subs in groups:
        body = build_zone_overview(zone, subs, attach_index)

        # 文件专区要额外挂附件浏览器的 CSS / JS
        extra_css = ""
        extra_js = ""
        if zone.get("key") == "download":
            extra_css = ('    <link rel="stylesheet" '
                         'href="../assets/css/file-browser.css?v=@@VER@@">')
            extra_js = ('    <script src="../assets/js/file-browser.js?v=@@VER@@"></script>')

        html = render_page(
            escape_html(zone["title"]),
            escape_html(zone["desc"]),
            body,
            breadcrumb=('<nav class="breadcrumb" aria-label="面包屑">\n'
                        '        <a href="../index.html">首页</a>\n'
                        '        <span class="crumb-sep">/</span>\n'
                        '        <span class="crumb-current">%s</span>\n'
                        '    </nav>' % escape_html(zone["title"])),
            pagenav=('<nav class="pagenav" aria-label="页面导航">\n'
                     '        <div class="pagenav-row">\n'
                     '            <span class="pagenav-slot"></span>\n'
                     '            <span class="pagenav-slot"></span>\n'
                     '        </div>\n'
                     '    </nav>'),
            backbtn=BACKBTN_TEMPLATE % (
                escape_html("../index.html"),
                escape_html("首页"),
            ),
            url_path="pages/%s.html" % zone["key"],
            keywords=",".join([zone["title"], zone.get("brief", "")]),
            extra_css=extra_css,
            extra_js=extra_js,
            jsonld=render_ld_script(build_page_ld(
                page_title=zone["title"],
                desc=zone["desc"],
                url_path="pages/%s.html" % zone["key"],
                zone_title=zone["title"],
                zone_key=zone["key"],
            )),
        )
        out = os.path.join(PAGES, "%s.html" % zone["key"])
        with io.open(out, "w", encoding="utf-8", newline="") as f:
            f.write(html)
        built.append(out)

    for p in built:
        print("built:", os.path.relpath(p, OUT))

    print("\n共生成 %d 个页面（子板块 %d + 专区总览 %d）"
          % (len(built), len(items), len(groups)))

    # ---- 附件匹配告警 ----
    if ATTACH_WARNINGS:
        uniq = sorted(set(ATTACH_WARNINGS))
        print("\n[附件未匹配] %d 个链接找不到对应文件：" % len(uniq))
        for u in uniq:
            print("  !", u)
    else:
        print("附件链接全部匹配成功。")


if __name__ == "__main__":
    main()
