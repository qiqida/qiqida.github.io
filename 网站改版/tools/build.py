# -*- coding: utf-8 -*-
"""
build.py —— 「网站改版」一键构建脚本

把「网站内容信息」的 md 正文，按新专区结构转成静态 HTML 页面，
输出到「网站改版/pages/」，并同步生成 data/ 下的 JSON 配置文件。

运行：
    python 网站改版/tools/build.py
"""
import io
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from md2html import convert, read_text, render_page, escape_html  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "网站内容信息")
OUT = os.path.join(ROOT, "网站改版")
PAGES = os.path.join(OUT, "pages")
DATA = os.path.join(OUT, "data")
FILES = os.path.join(OUT, "files")


# ==========================================================
# 专区定义：每个专区 = 一个 HTML 页面，内含若干子板块
# ==========================================================
ZONES = [
    {
        "key": "freshman",
        "page": "freshman.html",
        "title": "新生专区",
        "desc": "报到、迎新、党团转接、入学教育、培养方案与导师双选",
        "icon": "🧭",
        "sub_blocks": [
            ("report", "报到与迎新", "02_新生专区/01_报到与迎新.md", "从录取到正式上课的完整流程、缴费渠道与报到材料清单"),
            ("party", "党团关系转接", "02_新生专区/02_新生党团转接.md", "党组织关系与团组织关系的转入步骤"),
            ("education", "入学教育与体检", "02_新生专区/03_入学教育与体检.md", "入学教育安排、体检与安全教育考试"),
            ("course", "培养方案与选课", "02_新生专区/04_培养方案与选课.md", "培养方案确认、选课入口与学分要求"),
            ("advisor", "导师双选", "02_新生专区/05_导师双选.md", "双向选择流程与注意事项"),
        ],
    },
    {
        "key": "study",
        "page": "study.html",
        "title": "在校学习专区",
        "desc": "请假与考勤、选课退课、考试成绩、学籍异动、毕业设计、学术资源",
        "icon": "📚",
        "sub_blocks": [
            ("leave", "请假与考勤", "03_在校学习专区/01_请假与考勤.md", "线下请假条与线上出省报备两条线、天数与审批级别"),
            ("course", "选课与退课", "03_在校学习专区/02_选课与退课.md", "选课、退课与补选的操作入口"),
            ("exam", "考试与成绩", "03_在校学习专区/03_考试与成绩.md", "缓考、补考与成绩复核"),
            ("status", "学籍异动", "03_在校学习专区/04_学籍异动.md", "休学、复学、转专业与保留学籍"),
            ("thesis", "毕业设计", "03_在校学习专区/05_毕业设计.md", "开题、中期检查、查重与答辩的培养环节"),
            ("academic", "学术资源使用", "03_在校学习专区/06_学术资源使用.md", "学术资源访问申请与校外访问方法"),
            ("patent", "专利与软著申请", "03_在校学习专区/07_专利与软著申请.md", "专利与软件著作权的申请入口与流程"),
        ],
    },
    {
        "key": "aid",
        "page": "aid.html",
        "title": "奖助专区",
        "desc": "奖学金、助学金与助学贷款、困难认定、三助一辅岗位",
        "icon": "💰",
        "sub_blocks": [
            ("scholarship", "奖学金申请", "04_奖助专区/01_奖学金申请.md", "学业奖学金等级金额、评分规则与评选流程"),
            ("loan", "助学金与助学贷款", "04_奖助专区/02_助学金与助学贷款.md", "国家助学金与生源地信用助学贷款"),
            ("hardship", "家庭经济困难认定", "04_奖助专区/03_家庭经济困难认定.md", "四项佐证材料与提交要求"),
            ("assistant", "三助一辅岗位", "04_奖助专区/04_三助一辅岗位.md", "助研、助教、助管岗位招聘"),
        ],
    },
    {
        "key": "party",
        "page": "party.html",
        "title": "党团专区",
        "desc": "党组织关系转接、团组织关系、党员发展、班级与班委",
        "icon": "🏛️",
        "sub_blocks": [
            ("transfer", "党组织关系转接", "05_党团专区/01_党组织关系转接.md", "线上转接与线下介绍信两种方式"),
            ("league", "团组织关系与智慧团建", "05_党团专区/02_团组织关系与智慧团建.md", "团员关系转入与智慧团建操作"),
            ("develop", "党员发展流程", "05_党团专区/03_党员发展流程.md", "入党各阶段与要求"),
            ("class", "班级与班委", "05_党团专区/04_班级与班委.md", "班级划分与班委报名"),
        ],
    },
    {
        "key": "life",
        "page": "life.html",
        "title": "生活与证件专区",
        "desc": "宿舍、一卡通、网络账号、场地借用、心理医保、学生证与证明",
        "icon": "🏠",
        "sub_blocks": [
            ("dorm", "宿舍报修与退宿", "06_生活与证件专区/01_宿舍报修与退宿.md", "水电报修、退宿与校外住宿"),
            ("card", "一卡通补办", "06_生活与证件专区/02_一卡通补办.md", "绑定、挂失、补办与领取"),
            ("network", "网络与账号", "06_生活与证件专区/03_网络与账号.md", "校园网账号与正版软件获取"),
            ("venue", "场地借用与活动申报", "06_生活与证件专区/04_一站式场地借用.md", "场地借用与活动申报流程"),
            ("medical", "心理咨询与医保", "06_生活与证件专区/05_心理咨询与医保.md", "医保参保与心理咨询预约"),
            ("idcard", "学生证补办", "06_生活与证件专区/06_学生证补办.md", "研究生证填写与补办流程"),
            ("certificate", "在读与成绩证明", "06_生活与证件专区/07_在读与成绩证明.md", "在读证明与成绩单开具"),
        ],
    },
    {
        "key": "career",
        "page": "career.html",
        "title": "实习就业与毕业专区",
        "desc": "实习与外出报备、实习证明、三方协议、升学出国、毕业与离校",
        "icon": "🎓",
        "sub_blocks": [
            ("internship", "实习申请与外出报备", "07_实习就业与毕业专区/01_实习申请与外出报备.md", "实习三张表与外出报备须知"),
            ("proof", "实习证明开具", "07_实习就业与毕业专区/02_实习证明开具.md", "实习证明的申请与开具"),
            ("employment", "就业推荐与三方协议", "07_实习就业与毕业专区/03_就业推荐与三方协议.md", "就业推荐表与三方协议签订"),
            ("abroad", "升学与出国交流", "07_实习就业与毕业专区/04_升学与出国交流.md", "保研考研与因公出国境"),
            ("qualify", "毕业资格审核", "07_实习就业与毕业专区/05_毕业资格审核.md", "毕业资格审核的条件与流程"),
            ("degree", "学位申请与论文送审", "07_实习就业与毕业专区/06_学位申请与论文送审.md", "学位申请、论文送审与答辩安排"),
            ("archive", "毕业材料与档案", "07_实习就业与毕业专区/07_毕业材料与档案.md", "毕业登记表、材料清单与档案转递"),
            ("leave-school", "离校手续", "07_实习就业与毕业专区/08_离校手续.md", "离校前要办的事项与办理顺序"),
        ],
    },
]


# ==========================================================
# 文件专区（5 类）与问题专区（4 类）
# ==========================================================
DOWNLOAD_CATEGORIES = [
    ("leave", "请假条与报备单", "08_文件专区/01_请假条与报备单.md"),
    ("forms", "申请表与审批表", "08_文件专区/02_申请表与审批表.md"),
    ("proof", "证明与协议模板", "08_文件专区/03_证明与协议模板.md"),
    ("apply", "申请书与总结模板", "08_文件专区/04_申请书与总结模板.md"),
    ("archive", "附件与截图归档", "08_文件专区/05_附件与截图归档.md"),
]

ISSUE_CATEGORIES = [
    ("system", "系统操作问题", "09_问题专区/01_系统操作问题.md"),
    ("material", "材料与审核问题", "09_问题专区/02_材料与审核问题.md"),
    ("block", "流程卡点", "09_问题专区/03_流程卡点.md"),
    ("contact", "找谁问与反馈", "09_问题专区/04_找谁问与反馈.md"),
]


# ==========================================================
# 附件路径重写
# ==========================================================
# 源目录名 → 站点 files/ 下的短名
ATTACHMENT_CATEGORY = {
    "01_请假条与报备单": "leave",
    "02_申请表与审批表": "forms",
    "03_证明与协议模板": "proof",
    "04_申请书与总结模板": "apply",
    "05_说明与截图归档": "archive",
}


def fix_attachment_links(html):
    """
    把 md 里的相对附件路径改成站点路径 ../files/<短名>/<文件名>。

    md 里可能是：
      ../08_文件专区/附件/01_请假条与报备单/xxx.doc
      ./附件/01_请假条与报备单/xxx.doc
    """
    prefixes = ("../08_文件专区/附件/", "附件/")

    out = []
    pos = 0

    # 逐个找 href=" 或 src=" 开头、指向附件目录的链接
    while True:
        best = None
        for pfx in prefixes:
            idx = html.find(pfx, pos)
            if idx == -1:
                continue
            if best is None or idx < best[0]:
                best = (idx, pfx)

        if best is None:
            break

        start, pfx = best
        # 往前找最近的引号，确认这是属性值
        quote_pos = html.rfind('"', 0, start)
        if quote_pos == -1 or start - quote_pos > 3:
            out.append(html[pos:start + len(pfx)])
            pos = start + len(pfx)
            continue

        # 找到属性的结束引号
        end = html.find('"', start)
        if end == -1:
            break

        rest = html[start + len(pfx):end]
        parts = rest.split("/", 1)
        short = ATTACHMENT_CATEGORY.get(parts[0]) if len(parts) == 2 else None

        out.append(html[pos:start])
        if short:
            out.append(pfx.replace("../08_文件专区/附件/", "").replace("附件/", ""))
            out.append("../files/%s/%s" % (short, parts[1]))
        else:
            out.append(html[start:end])

        pos = end

    out.append(html[pos:])
    return "".join(out)


# ==========================================================
# 页面构建
# ==========================================================
def build_zone_page(zone):
    """把一个专区的多个 md 合并成一个 HTML 页面"""
    parts = []

    parts.append('<nav class="guide-toc" aria-label="本页目录">')
    parts.append('<p class="guide-toc-title">本页内容</p>')
    parts.append("<ul>")
    for anchor, title, _md, desc in zone["sub_blocks"]:
        parts.append(
            '<li><a href="#%s">%s</a><span class="guide-toc-desc">%s</span></li>'
            % (anchor, title, desc)
        )
    parts.append("</ul>")
    parts.append("</nav>")

    for anchor, title, md_rel, desc in zone["sub_blocks"]:
        parts.append('<section class="guide-block" id="%s">' % anchor)
        parts.append(
            '<h2 class="guide-block-title">%s</h2>' % title
        )
        if desc:
            parts.append('<p class="guide-block-desc">%s</p>' % desc)

        src = os.path.join(SRC, md_rel.replace("/", os.sep))
        if os.path.exists(src):
            body = convert(read_text(src))
            body = fix_attachment_links(body)
            parts.append(body)
        else:
            parts.append('<div class="guide-empty">该部分内容正在整理，暂未上线。</div>')

        parts.append("</section>")

    return "\n".join(parts)


def build_single_page(page_name, title, desc, extra_md=None):
    """构建单页（文件专区、问题专区、关于与联系）"""
    parts = []
    for md_rel in extra_md or []:
        src = os.path.join(SRC, md_rel.replace("/", os.sep))
        if os.path.exists(src):
            body = convert(read_text(src))
            body = fix_attachment_links(body)
            parts.append('<section class="guide-block">')
            parts.append(body)
            parts.append("</section>")
        else:
            parts.append('<div class="guide-empty">该部分内容正在整理，暂未上线。</div>')

    html = render_page(escape_html(title), escape_html(desc), "\n".join(parts))
    out = os.path.join(PAGES, page_name)
    with io.open(out, "w", encoding="utf-8", newline="") as f:
        f.write(html)
    return out


def main():
    # 只清理 pages；data 目录里既有自动生成的，也有手写的，
    # 每次全删会把 notices.json / faq.json 这些手写文件弄丢。
    if os.path.isdir(PAGES):
        shutil.rmtree(PAGES)
    os.makedirs(PAGES)
    if not os.path.isdir(DATA):
        os.makedirs(DATA)
    if not os.path.isdir(FILES):
        os.makedirs(FILES)

    built = []

    # 1. 六个专区（文件专区、问题专区单独构建）
    for zone in ZONES:
        body = build_zone_page(zone)
        html = render_page(
            escape_html(zone["title"]),
            escape_html(zone["desc"]),
            body,
        )
        out = os.path.join(PAGES, zone["page"])
        with io.open(out, "w", encoding="utf-8", newline="") as f:
            f.write(html)
        built.append(out)

    # 2. 文件专区
    built.append(build_single_page(
        "download.html", "文件专区",
        "请假条、申请表、证明协议、申请书与总结模板下载",
        extra_md=[md for _a, _t, md in DOWNLOAD_CATEGORIES],
    ))

    # 3. 问题专区
    built.append(build_single_page(
        "faq.html", "问题专区",
        "系统操作、材料审核、流程卡点、找谁问与反馈",
        extra_md=[md for _a, _t, md in ISSUE_CATEGORIES],
    ))

    # 4. 关于与联系
    built.append(build_single_page(
        "about.html", "关于与联系",
        "网站说明、咨询方式与办公时间、办事地点指引",
        extra_md=[
            "10_关于与联系/01_网站说明与免责声明.md",
            "10_关于与联系/02_咨询方式与办公时间.md",
            "10_关于与联系/03_办事地点指引.md",
        ],
    ))

    for p in built:
        print("built:", os.path.relpath(p, ROOT))

    print("\n共生成 %d 个页面" % len(built))


if __name__ == "__main__":
    main()
