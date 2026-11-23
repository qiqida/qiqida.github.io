# -*- coding: utf-8 -*-
"""
searchpage.py —— 生成搜索结果页 pages/search.html

为什么要这个页
--------------
首页的搜索框是「即时下拉」，最多显示 6 条。缺三样东西：

  1. 搜「请」想看全部匹配 —— 下拉里没有
  2. 搜了个不存在的词 —— 下拉只说「没找到」，学生没地方去
  3. 搜索词完全不被记录 —— 不知道学生实际在搜什么

这个页面承接前两样（第三样靠前端上报 + Worker）。

实现方式
--------
**静态页 + 客户端渲染**，不做构建时预生成：
  · 数据还是那份 data/knowledge-base.json
  · 浏览器读 URL 里的 ?q= 参数，在前端渲染结果
  · 加了新内容不用重新生成这个页面，索引更新了就自动生效

所以这个脚本只需要吐一个 HTML 骨架，逻辑都在 assets/js/search-page.js。

运行：
    python 网站改版2/tools/searchpage.py
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from siteconf import OUT, PAGES, escape_html  # noqa: E402
from md2html import SITE_VER, load_ga_id  # noqa: E402

SITE_BASE = "https://qiqida.github.io"


TEMPLATE = """<!DOCTYPE html>
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
    <title>搜索 | 工学部研究生事务服务中心</title>
    <meta name="description" content="搜索本站的办事流程、材料清单与常见问题。">
    <meta name="keywords" content="搜索,请假,奖学金,选课,一卡通,离校手续">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="工学部研究生事务服务中心">
    <meta property="og:title" content="搜索 | 工学部研究生事务服务中心">
    <meta property="og:description" content="搜索本站的办事流程、材料清单与常见问题。">
    <meta property="og:url" content="https://qiqida.github.io/pages/search.html">
    <meta property="og:locale" content="zh_CN">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="搜索 | 工学部研究生事务服务中心">
    <meta name="twitter:description" content="搜索本站的办事流程、材料清单与常见问题。">

    <link rel="canonical" href="https://qiqida.github.io/pages/search.html">

    <!-- 结构化数据：搜索结果页本身不需要 FAQ/HowTo，
         只声明它是站点的一部分 -->
    <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://qiqida.github.io/pages/search.html#webpage",
      "url": "https://qiqida.github.io/pages/search.html",
      "name": "搜索 | 工学部研究生事务服务中心",
      "description": "搜索本站的办事流程、材料清单与常见问题。",
      "isPartOf": {
        "@type": "WebSite",
        "@id": "https://qiqida.github.io/",
        "name": "工学部研究生事务服务中心",
        "url": "https://qiqida.github.io/"
      },
      "inLanguage": "zh-CN"
    },
    {
      "@type": "SearchResultsPage",
      "@id": "https://qiqida.github.io/pages/search.html#results",
      "name": "站内搜索结果"
    }
  ]
}
    </script>

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">
    <link rel="apple-touch-icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">

    <script src="../assets/js/theme-init.js"></script>
    <script>window.SITE_VER = "@@VER@@";</script>

    <link rel="stylesheet" href="../assets/css/style.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/components.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/v8-components.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/touch-feedback.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/theme-switch.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/a11y.css?v=@@VER@@">
    <link rel="stylesheet" href="../assets/css/search-page.css?v=@@VER@@">
</head>

<body id="page-top" data-root="..">

    <a class="skip-to-content" href="#main-content">跳到正文</a>

    <div class="header-stack">
        <header class="navbar">
            <a href="../index.html" class="logo-gsh">GSH</a>
            <div class="navbar-actions">
                <a href="../index.html" class="back-btn">返回首页</a>
                @@THEME_SWITCH@@
            </div>
        </header>
    </div>

    <main class="search-page" id="main-content">
        <nav class="breadcrumb" aria-label="面包屑">
            <a href="../index.html">首页</a>
            <span class="crumb-sep">/</span>
            <span class="crumb-current">搜索</span>
        </nav>

        <h1 style="margin: 0 0 6px; font-size: 26px; line-height: 1.3;">站内搜索</h1>
        <p style="margin: 0 0 22px; font-size: 14px; color: var(--subtext-color);">
            支持中文、拼音全拼和首字母（比如「请假」「qingjia」「qj」都能搜到）。
        </p>

        <div class="search-page-box">
            <input type="search" id="search-page-input" class="search-page-input"
                   placeholder="搜索请假、奖学金、毕业登记表..." aria-label="站内搜索"
                   autocomplete="off" autofocus>
        </div>

        <p class="search-page-count" id="search-page-count"></p>

        <ul class="search-results" id="search-results"></ul>

        <section class="search-related" id="search-related" hidden>
            <h2 class="search-related-title">试试这些</h2>
            <div class="search-related-list" id="search-related-list"></div>
        </section>
    </main>

    <footer class="footer">
        <p>工学部研究生事务服务中心 © 2026</p>
        <p class="footer-note">本站只整理流程与材料说明，不受理申请、不审批、不发布通知。当年的日期、名额、金额以学校与学院官方通知为准。</p>
    </footer>

    <script src="../assets/js/theme.js?v=@@VER@@"></script>
    <script src="../assets/js/search-page.js?v=@@VER@@"></script>
</body>
</html>
"""


def main():
    # 主题切换开关（和首页、子页面共用同一份结构）
    from md2html import THEME_SWITCH_HTML

    html = TEMPLATE
    html = html.replace("@@THEME_SWITCH@@", THEME_SWITCH_HTML)
    html = html.replace("@@VER@@", SITE_VER)
    html = html.replace("@@GAID@@", load_ga_id())

    out = os.path.join(PAGES, "search.html")
    with io.open(out, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    print("built:", os.path.relpath(out, OUT))


if __name__ == "__main__":
    main()
