# -*- coding: utf-8 -*-
"""
home.py —— 生成新首页 index.html（「网站改版2」）

沿用「网站改版」的主页面架构：
  - 品牌区（hero）
  - 八个专区卡片（悬停/点击展开子板块）
  - 重要通知
  - 常用事务
  - 热门问题
  - 常见搜索词
  - 数据统计

差异：所有链接都指向**独立的子板块页面**（pages/study-leave.html），
专区卡片本身指向专区总览页（pages/study.html）。

运行：
    python 网站改版2/tools/home.py
"""
import io
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import OUT, SCENARIOS, ZONES, scan_content  # noqa: E402
from md2html import SITE_VER, load_ga_id  # noqa: E402

# 首页卡片区的专区。
# 「关于与联系」不在卡片区（放在页脚），所以它没有 inHome 标记。
HOME_ZONE_KEYS = [z["key"] for z in ZONES if z.get("inHome")]

# 常用事务 → 子页面短名（与 siteconf.SCENARIOS 一致）


def build_cards():
    cards = []
    for key in HOME_ZONE_KEYS:
        zone = None
        for z in ZONES:
            if z["key"] == key:
                zone = z
                break
        if not zone:
            continue
        cards.append(
            """                <div class="card" data-category="%s">
                    <a class="card-overlay" href="pages/%s.html" aria-label="%s"></a>
                    <div class="card-body">
                        <button class="card-toggle" type="button" aria-expanded="false" aria-label="查看%s包含的子板块">
                            <span class="card-toggle-icon" aria-hidden="true"></span>
                        </button>
                        <div class="card-icon">%s</div>
                        <h3>%s</h3>
                        <p class="card-brief">%s</p>
                        <span class="card-subcount"></span>
                    </div>
                    <div class="card-sublist" aria-label="%s包含的子板块"></div>
                </div>""" % (
                key, key, zone["title"], zone["title"], zone["icon"], zone["title"],
                zone["brief"], zone["title"]
            )
        )
    return "\n".join(cards)


def build_scenarios():
    """常用事务：学生原话 → 子页面"""
    scen = []
    for phrase, zone, target, slug in SCENARIOS:
        scen.append(
            """                    <a class="scenario-item" href="pages/%s.html">
                        <span class="scenario-phrase">%s</span>
                        <span class="scenario-arrow">→</span>
                        <span class="scenario-target">%s</span>
                        <span class="scenario-zone">%s</span>
                    </a>""" % (slug, phrase, target, zone)
        )
    return "\n".join(scen)


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
    <title>工学部研究生事务服务中心</title>
    <meta name="description" content="工学部研究生事务服务中心 —— 八个专区，把重复的事务工作变成一次解决。">
    <meta name="keywords" content="研究生事务,请假,奖学金,选课,一卡通,离校手续,党团关系,专利,工学部">

    <!-- 分享卡片（微信 / QQ / 微博 转发时显示标题与摘要） -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="工学部研究生事务服务中心">
    <meta property="og:title" content="工学部研究生事务服务中心">
    <meta property="og:description" content="八个专区，把重复的事务工作变成一次解决。">
    <meta property="og:url" content="https://qiqida.github.io/">
    <meta property="og:locale" content="zh_CN">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="工学部研究生事务服务中心">
    <meta name="twitter:description" content="八个专区，把重复的事务工作变成一次解决。">

    <!-- 规范地址，避免搜索引擎把带参数的链接当成重复内容 -->
    <link rel="canonical" href="https://qiqida.github.io/">

    <!-- Favicon 图标 -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">
    <link rel="apple-touch-icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">

    <!-- 提前应用夜间模式，避免页面闪动 -->
    <script src="assets/js/theme-init.js"></script>

    <!-- 全站资源版本号。
         JS 里 fetch 数据文件时统一用 SITE_VER 拼 ?v=，
         这样内容更新后浏览器不会拿旧的 JSON 缓存。 -->
    <script>window.SITE_VER = "@@VER@@";</script>

    <link rel="stylesheet" href="assets/css/style.css?v=@@VER@@">
    <link rel="stylesheet" href="assets/css/components.css?v=@@VER@@">
    <link rel="stylesheet" href="assets/css/touch-feedback.css?v=@@VER@@">
    <link rel="stylesheet" href="assets/css/v8-components.css?v=@@VER@@">
    <link rel="stylesheet" href="assets/css/card-sublist.css?v=@@VER@@">
    <link rel="stylesheet" href="assets/css/home-sections.css?v=@@VER@@">
    <link rel="stylesheet" href="assets/css/notice-section.css?v=@@VER@@">
    <link rel="stylesheet" href="assets/css/a11y.css?v=@@VER@@">
</head>

<body>

    <!-- 键盘用户按 Tab 第一下就能跳到正文 -->
    <a class="skip-to-content" href="#main-content">跳到正文</a>

    <div id="page-root" class="page-root">

    <!-- ==========================================================
         吸顶头部：navbar + 搜索条

         两层装在同一个 .header-stack 里，靠它一个 sticky
         一起吸住。这样不管 navbar 高度怎么变（首页 / 子页不同）、
         搜索条放上面还是下面，两层永远贴合，不会漏缝。

         桌面端和移动端用的是同一套结构：
           · 桌面端显示 .desktop-search
           · 移动端显示 .mobile-search
         高度由 header-height.js 实测写回 --header-h 变量。
         ========================================================== -->
    <div class="header-stack">
        <header class="navbar">
            <div class="logo">工学部研究生事务服务中心</div>
            <button id="theme-toggle" type="button" aria-label="切换深色模式">🌙</button>
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

    <main id="main-content">

        <section class="hero" id="hero-section">
            <div class="hero-logo">GSH</div>
            <p class="hero-subtitle">Graduate Service Hub</p>
            <p class="hero-mission">把重复的事务工作，变成一次解决</p>
        </section>

        <section class="content-area" id="content-area">

            <!-- ========== 八个专区 ========== -->
            <section class="card-grid" id="card-grid">
@@CARDS@@
            </section>

            <!-- ========== 重要通知 ========== -->
            <section class="home-section">
                <div class="section-header">
                    <h2>重要通知</h2>
                    <a href="pages/notice-2026100.html">本站怎么用</a>
                </div>
                <div id="notice-container"></div>
            </section>

            <!-- ========== 常用事务 ========== -->
            <section class="home-section">
                <div class="section-header">
                    <h2>常用事务</h2>
                    <a href="pages/faq-block.html">找不到？去问题专区</a>
                </div>
                <p class="section-hint">按你平时怎么说来找，不用记部门名称。</p>
                <div class="scenario-grid">
@@SCENARIOS@@
                </div>
            </section>

            <!-- ========== 热门问题 ========== -->
            <section class="home-section">
                <div class="section-header">
                    <h2>热门问题</h2>
                    <a href="pages/faq.html">查看全部</a>
                </div>
                <div id="home-faq-container"></div>
            </section>

            <!-- ========== 常见搜索词 ========== -->
            <section class="home-section">
                <div class="section-header">
                    <h2>常见搜索词</h2>
                </div>
                <div class="search-card">
                    <div class="search-tags" id="search-stats-container">
                    </div>
                </div>
            </section>

            <!-- ========== 数据统计 ==========
                 这四个数字都是**站内实际有多少**，
                 构建时从真实文件算出来写进页面，不是编的。
                 访问量不在这儿 —— 那个要看 Google Analytics。 -->
            <section class="home-section stats-section">
                <div class="section-header">
                    <h2>站点内容</h2>
                </div>
                <div class="student-data-grid">
                    <div class="data-card" id="stat-card-files">
                        <div class="data-icon">📁</div>
                        <div class="data-content">
                            <h3 id="stat-files">—</h3>
                            <p>可下载资料</p>
                        </div>
                    </div>
                    <div class="data-card" id="stat-card-pages">
                        <div class="data-icon">📄</div>
                        <div class="data-content">
                            <h3 id="stat-pages">—</h3>
                            <p>流程页面</p>
                        </div>
                    </div>
                    <div class="data-card" id="stat-card-zones">
                        <div class="data-icon">🗂️</div>
                        <div class="data-content">
                            <h3 id="stat-zones">—</h3>
                            <p>事务专区</p>
                        </div>
                    </div>
                    <div class="data-card" id="stat-card-faq">
                        <div class="data-icon">💬</div>
                        <div class="data-content">
                            <h3 id="stat-faq">—</h3>
                            <p>常见问题</p>
                        </div>
                    </div>
                </div>
            </section>

        </section> <!-- 关闭 content-area -->

    </main>

    <!-- 底部品牌区 -->
    <footer class="site-footer-mini">
        <div class="footer-mini-line"></div>
        <div class="footer-mini-content">
            <div class="footer-mini-logo">GSH</div>
            <p class="footer-mini-name">工学部研究生事务服务中心</p>
            <p class="footer-mini-version">Version 2026</p>
        </div>
    </footer>

    </div>

    <!-- 左侧悬浮反馈按钮 -->
    <button id="feedback-float-btn" class="feedback-float-btn" aria-label="留言反馈">
        💬 留言反馈
    </button>

    <!-- 左侧滑出反馈面板 -->
    <aside id="feedback-panel" class="feedback-panel" aria-label="反馈面板">
        <div class="feedback-panel-header">
            <h3>留言反馈</h3>
            <button type="button" id="feedback-panel-close" aria-label="关闭">✕</button>
        </div>
        <div class="feedback-panel-body">
            <form id="feedback-form" class="feedback-form">
                <div class="form-group">
                    <label for="feedback-name">姓名（可选）</label>
                    <input type="text" id="feedback-name" name="name" placeholder="请输入您的姓名">
                </div>
                <div class="form-group">
                    <label for="feedback-content">留言内容 <span class="required">*</span></label>
                    <textarea id="feedback-content" name="content" rows="5" placeholder="请输入您的留言内容..." required></textarea>
                    <div class="char-count">0/500</div>
                </div>
                <button type="button" class="feedback-submit-btn">提交留言</button>
                <div class="feedback-survey-link" id="feedback-survey-block" hidden>
                    <p>或通过问卷星提交：</p>
                    <a href="#" class="survey-link-btn" id="survey-link" rel="noopener noreferrer" target="_blank">
                        打开问卷星
                    </a>
                </div>
            </form>
        </div>
    </aside>

    <script src="assets/js/theme.js?v=@@VER@@"></script>
    <script src="assets/js/header-height.js?v=@@VER@@"></script>
    <script src="assets/js/search.js?v=@@VER@@"></script>
    <script src="assets/js/notice-section.js?v=@@VER@@"></script>
    <script src="assets/js/homeFaq.js?v=@@VER@@"></script>
    <script src="assets/js/stats.js?v=@@VER@@"></script>
    <script src="assets/js/feedback.js?v=@@VER@@"></script>
    <script src="assets/js/feedback-float.js?v=@@VER@@"></script>
    <script src="assets/js/search-stats.js?v=@@VER@@"></script>
    <script src="assets/js/card-sublist.js?v=@@VER@@"></script>

</body>
</html>
"""


def main():
    cards = build_cards()
    scen = build_scenarios()

    html = TEMPLATE
    html = html.replace("@@CARDS@@", cards)
    html = html.replace("@@SCENARIOS@@", scen)
    # 资源版本号：改过 JS/CSS 后浏览器会强制取新文件，避免缓存旧版本。
    # 复用 md2html 的版本号，保证首页和子页面引用同一批资源。
    html = html.replace("@@VER@@", SITE_VER)

    # GA 测量 ID（从 data/site-config.json 读，读不到用默认值）
    html = html.replace("@@GAID@@", load_ga_id())

    out = os.path.join(OUT, "index.html")
    with io.open(out, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    print("built:", os.path.relpath(out, OUT))


if __name__ == "__main__":
    main()
