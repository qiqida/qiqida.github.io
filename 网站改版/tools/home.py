# -*- coding: utf-8 -*-
"""
home.py —— 生成新首页 index.html

基于原站首页结构，保留：
  - 品牌区（hero）不动
  - 热门问题
  - 热门搜索关键词
  - 数据统计

改动：
  - 八个专区卡片重新命名（实习+毕业合并成一张，新增奖助专区）
  - 卡片取消简介文字（不显示 <p> 描述）
  - 新增「重要通知」区块（置顶通知大卡片 + 普通通知紧凑行）
  - 新增「我要办点事」场景速查
  - 新增「热门流程」Top6
"""
import io
import os
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "网站改版")

# 8 个专区：(key, 图标, 标题, 目标页)
ZONE_CARDS = [
    ("freshman", "🧭", "新生专区", "freshman.html"),
    ("study", "📚", "在校学习专区", "study.html"),
    ("aid", "💰", "奖助专区", "aid.html"),
    ("party", "🏛️", "党团专区", "party.html"),
    ("life", "🏠", "生活与证件专区", "life.html"),
    ("career", "🎓", "实习就业与毕业专区", "career.html"),
    ("download", "📂", "文件专区", "download.html"),
    ("faq", "❓", "问题专区", "faq.html"),
]

# 常用事务：学生原话 → 专区（只留 6 个最高频的）
SCENARIOS = [
    ("我要请假", "在校学习专区", "请假与考勤", "pages/study.html#leave"),
    ("我要开在读证明 / 成绩单", "生活与证件专区", "在读与成绩证明", "pages/life.html#certificate"),
    ("我要领奖助 / 交困难认定材料", "奖助专区", "按事项进对应子页", "pages/aid.html"),
    ("我要去实习 / 交外出报备", "实习就业与毕业专区", "实习申请与外出报备", "pages/career.html#internship"),
    ("我要下载表格", "文件专区", "五类模板索引", "pages/download.html"),
    ("我卡住了 / 不知道找谁", "问题专区", "流程卡点、找谁问与反馈", "pages/faq.html"),
]


def build():
    cards = []
    for key, icon, title, page in ZONE_CARDS:
        cards.append(
            """                <div class="card" data-category="%s">
                    <a class="card-overlay" href="pages/%s" aria-label="%s"></a>
                    <div class="card-body">
                        <button class="card-toggle" type="button" aria-expanded="false" aria-label="查看%s包含的子板块">
                            <span class="card-toggle-icon" aria-hidden="true"></span>
                        </button>
                        <div class="card-icon">%s</div>
                        <h3>%s</h3>
                        <span class="card-subcount"></span>
                    </div>
                    <div class="card-sublist" aria-label="%s包含的子板块"></div>
                </div>"""
            % (key, page, title, title, icon, title, title)
        )
    cards_html = "\n".join(cards)

    scen = []
    for phrase, zone, target, url in SCENARIOS:
        scen.append(
            """                    <a class="scenario-item" href="%s">
                        <span class="scenario-phrase">%s</span>
                        <span class="scenario-arrow">→</span>
                        <span class="scenario-target">%s</span>
                        <span class="scenario-zone">%s</span>
                    </a>"""
            % (url, phrase, target, zone)
        )
    scen_html = "\n".join(scen)

    top = []
    for title, desc, url, icon in []:
        top.append(
            """                    <a class="top-item" href="%s">
                        <span class="top-icon">%s</span>
                        <span class="top-text">
                            <strong>%s</strong>
                            <em>%s</em>
                        </span>
                    </a>"""
            % (url, icon, title, desc)
        )
    top_html = "\n".join(top)

    return cards_html, scen_html, top_html


TEMPLATE = """<!DOCTYPE html>
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
    <title>工学部研究生事务服务中心</title>

    <!-- Favicon 图标 -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">
    <link rel="apple-touch-icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%231d1d1f'/><text x='50' y='68' font-size='40' font-weight='bold' text-anchor='middle' fill='white'>GSH</text></svg>">

    <!-- 提前应用夜间模式，避免页面闪动 -->
    <script src="assets/js/theme-init.js"></script>

    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/components.css">
    <link rel="stylesheet" href="assets/css/touch-feedback.css">
    <link rel="stylesheet" href="assets/css/v8-components.css">
    <link rel="stylesheet" href="assets/css/card-sublist.css">
    <link rel="stylesheet" href="assets/css/home-sections.css">
    <link rel="stylesheet" href="assets/css/notice-section.css">
</head>

<body>

    <!-- 手机端搜索框：放在 pageRoot 外面，不受页面 transform 影响 -->
    <div class="mobile-search" id="mobile-search-container">
        <div class="search-bar-wrapper">
            <input type="text" id="global-search" class="search-box" placeholder="搜索请假、奖学金、毕业登记表...">
            <div id="search-suggestions"></div>
        </div>
    </div>

    <div id="page-root" class="page-root">

    <header class="navbar">
        <div class="logo">工学部研究生事务服务中心</div>
        <button id="theme-toggle" type="button">🌙</button>
    </header>

    <main>

        <section class="hero" id="hero-section">
            <div class="hero-logo">GSH</div>
            <p class="hero-subtitle">Graduate Service Hub</p>
            <p class="hero-mission">把重复的事务工作，变成一次解决</p>
            <!-- 网页端搜索框：在 hero 内部 -->
            <div class="search-bar-wrapper desktop-search">
                <input type="text" id="global-search-desktop" class="search-box" placeholder="搜索请假、奖学金、毕业登记表...">
                <div id="search-suggestions-desktop"></div>
            </div>
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
                    <a href="pages/notices.html">查看全部</a>
                </div>
                <div id="notice-container"></div>
            </section>

            <!-- ========== 常用事务 ========== -->
            <section class="home-section">
                <div class="section-header">
                    <h2>常用事务</h2>
                    <a href="pages/faq.html">找不到？去问题专区</a>
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

            <!-- ========== 热门搜索关键词 ========== -->
            <section class="home-section">
                <div class="section-header">
                    <h2>热门搜索关键词</h2>
                </div>
                <div class="search-card">
                    <div class="search-tags" id="search-stats-container">
                    </div>
                </div>
            </section>

            <!-- ========== 数据统计 ========== -->
            <section class="home-section stats-section">
                <div class="section-header">
                    <h2>数据统计</h2>
                </div>
                <div class="student-data-grid">
                    <div class="data-card" id="stat-card-week">
                        <div class="data-icon">📊</div>
                        <div class="data-content">
                            <h3 id="stat-visits">—</h3>
                            <p>本周访问</p>
                        </div>
                    </div>
                    <div class="data-card" id="stat-card-files">
                        <div class="data-icon">📁</div>
                        <div class="data-content">
                            <h3 id="stat-files">—</h3>
                            <p>资料数量</p>
                        </div>
                    </div>
                    <div class="data-card" id="stat-card-faq">
                        <div class="data-icon">💬</div>
                        <div class="data-content">
                            <h3 id="stat-faq">—</h3>
                            <p>常见问题</p>
                        </div>
                    </div>
                    <div class="data-card" id="stat-card-notices">
                        <div class="data-icon">📢</div>
                        <div class="data-content">
                            <h3 id="stat-notices">—</h3>
                            <p>重要通知</p>
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
                <div class="feedback-survey-link">
                    <p>或通过问卷星提交：</p>
                    <a href="https://www.wjx.cn/vm/example.aspx" class="survey-link-btn" id="survey-link">
                        打开问卷星
                    </a>
                </div>
            </form>
        </div>
    </aside>

    <script src="assets/js/theme.js?v=@@VER@@"></script>
    <script src="assets/js/search.js?v=@@VER@@"></script>
    <script src="assets/js/notice-section.js?v=@@VER@@"></script>
    <script src="assets/js/homeFaq.js"></script>
    <script src="assets/js/stats.js"></script>
    <script src="assets/js/feedback.js"></script>
    <script src="assets/js/feedback-float.js"></script>
    <script src="assets/js/download-rank.js"></script>
    <script src="assets/js/search-stats.js"></script>
    <script src="assets/js/card-sublist.js"></script>

</body>
</html>
"""


def main():
    cards, scen, top = build()
    html = TEMPLATE
    html = html.replace("@@CARDS@@", cards)
    html = html.replace("@@SCENARIOS@@", scen)
    html = html.replace("@@TOP6@@", top)
    # 资源版本号：改过 JS/CSS 后浏览器会强制取新文件，避免缓存旧版本
    html = html.replace("@@VER@@", str(int(time.time())))

    out = os.path.join(OUT, "index.html")
    with io.open(out, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    print("built:", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
