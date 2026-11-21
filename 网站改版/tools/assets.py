# -*- coding: utf-8 -*-
"""
assets.py —— 迁移附件 + 生成 data/ 下的 JSON 配置

1. 把「网站内容信息/08_文件专区/附件/」下的 27 个附件复制到「网站改版/files/」，
   按五类目录归档（去掉「0X_」前缀，改为站点用的短名）
2. 生成 data/downloads.json（文件专区列表）
3. 生成 data/categories.json（8 专区 + 子板块，首页卡片用）
4. 生成 data/knowledge-base.json（搜索索引）
5. 生成 data/search-stats.json（首页热门关键词）
"""
import io
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from md2html import read_text  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "网站内容信息")
OUT = os.path.join(ROOT, "网站改版")
DATA = os.path.join(OUT, "data")
FILES = os.path.join(OUT, "files")
ATT_SRC = os.path.join(SRC, "08_文件专区", "附件")

CATEGORY_MAP = [
    ("01_请假条与报备单", "leave"),
    ("02_申请表与审批表", "forms"),
    ("03_证明与协议模板", "proof"),
    ("04_申请书与总结模板", "apply"),
    ("05_说明与截图归档", "archive"),
]

CATEGORY_LABEL = {
    "leave": "请假条与报备单",
    "forms": "申请表与审批表",
    "proof": "证明与协议模板",
    "apply": "申请书与总结模板",
    "archive": "附件与截图归档",
}


def copy_attachments():
    """复制附件到 files/，返回附件清单"""
    items = []
    if not os.path.isdir(ATT_SRC):
        return items

    for src_dir, short in CATEGORY_MAP:
        src_path = os.path.join(ATT_SRC, src_dir)
        if not os.path.isdir(src_path):
            continue
        dst_path = os.path.join(FILES, short)
        if not os.path.isdir(dst_path):
            os.makedirs(dst_path)

        for fn in sorted(os.listdir(src_path)):
            src_file = os.path.join(src_path, fn)
            if not os.path.isfile(src_file):
                continue
            shutil.copy2(src_file, os.path.join(dst_path, fn))
            items.append({
                "title": os.path.splitext(fn)[0],
                "category": short,
                "categoryLabel": CATEGORY_LABEL[short],
                "file": "files/%s/%s" % (short, fn),
                "size": os.path.getsize(src_file),
                "ext": os.path.splitext(fn)[1].lower(),
            })
    return items


def write_json(path, data):
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2))
    print("wrote:", os.path.relpath(path, ROOT))


# ==========================================================
# categories.json —— 首页卡片与子板块
# ==========================================================
def build_categories():
    from build import ZONES, DOWNLOAD_CATEGORIES, ISSUE_CATEGORIES

    data = {}
    for zone in ZONES:
        items = []
        for anchor, title, _md, desc in zone["sub_blocks"]:
            items.append({
                "name": title,
                "type": "流程",
                "desc": desc,
                "url": "pages/%s#%s" % (zone["page"], anchor),
            })
        data[zone["key"]] = {
            "title": zone["title"],
            "desc": zone["desc"],
            "icon": zone["icon"],
            "items": items,
        }

    file_items = []
    for short, label, _md in DOWNLOAD_CATEGORIES:
        file_items.append({
            "name": label,
            "type": "表格",
            "desc": "该类文件汇总与下载",
            "url": "pages/download.html#%s" % short,
        })
    data["download"] = {
        "title": "文件专区",
        "desc": "请假条、申请表、证明协议、申请书与总结模板下载",
        "icon": "📂",
        "items": file_items,
    }

    issue_items = []
    for short, label, _md in ISSUE_CATEGORIES:
        issue_items.append({
            "name": label,
            "type": "FAQ",
            "desc": "常见问题与解答",
            "url": "pages/faq.html#%s" % short,
        })
    data["faq"] = {
        "title": "问题专区",
        "desc": "系统操作、材料审核、流程卡点、找谁问与反馈",
        "icon": "❓",
        "items": issue_items,
    }

    return data


# ==========================================================
# knowledge-base.json —— 搜索索引
# ==========================================================
SYNONYMS = {
    "请假与考勤": ["请假", "病假", "事假", "外出报备", "出省", "销假", "考勤"],
    "选课与退课": ["选课", "退课", "补选", "培养方案", "学分"],
    "考试与成绩": ["考试", "成绩", "缓考", "补考", "复核"],
    "学籍异动": ["休学", "复学", "转专业", "保留学籍", "学籍"],
    "毕业设计": ["毕设", "开题", "中期检查", "查重", "论文"],
    "学术资源使用": ["学术资源", "scholar", "外文文献", "数据库"],
    "专利与软著申请": ["专利", "软著", "软件著作权"],
    "报到与迎新": ["报到", "迎新", "迎新码", "录取", "注册"],
    "党团关系转接": ["党组织关系", "团组织关系", "转接", "介绍信"],
    "入学教育与体检": ["入学教育", "体检", "安全教育考试"],
    "培养方案与选课": ["培养方案", "选课", "学分", "课程"],
    "导师双选": ["导师", "选导", "双选"],
    "奖学金申请": ["奖学金", "学业奖学金", "国奖", "评选"],
    "助学金与助学贷款": ["助学金", "助学贷款", "生源地"],
    "家庭经济困难认定": ["困难认定", "经济困难", "佐证材料"],
    "三助一辅岗位": ["三助", "助研", "助教", "助管"],
    "党组织关系转接": ["党组织关系", "党务系统", "转接"],
    "团组织关系与智慧团建": ["智慧团建", "团员", "团组织"],
    "党员发展流程": ["入党", "党员发展", "积极分子", "预备党员"],
    "班级与班委": ["班委", "班级", "班干部"],
    "宿舍报修与退宿": ["报修", "退宿", "校外住宿", "宿舍", "水电"],
    "一卡通补办": ["一卡通", "校园卡", "挂失", "补办"],
    "网络与账号": ["校园网", "账号", "正版软件", "VPN"],
    "场地借用与活动申报": ["场地借用", "活动申报", "会议室"],
    "心理咨询与医保": ["心理咨询", "医保", "参保"],
    "学生证补办": ["学生证", "研究生证", "补办"],
    "在读与成绩证明": ["在读证明", "成绩单", "证明开具", "在校证明"],
    "实习申请与外出报备": ["实习", "外出报备", "社会实践", "四方协议"],
    "实习证明开具": ["实习证明"],
    "就业推荐与三方协议": ["三方协议", "就业推荐", "就业"],
    "升学与出国交流": ["保研", "考研", "出国", "出境", "因公出国"],
    "毕业资格审核": ["毕业资格", "审核"],
    "学位申请与论文送审": ["学位申请", "论文送审", "答辩", "查重"],
    "毕业材料与档案": ["毕业登记表", "档案", "派遣", "转递"],
    "离校手续": ["离校", "离校手续"],
    "请假条与报备单": ["请假条", "表格", "下载"],
    "申请表与审批表": ["申请表", "审批表", "下载"],
    "证明与协议模板": ["证明", "协议", "模板"],
    "申请书与总结模板": ["申请书", "总结"],
    "附件与截图归档": ["截图", "归档", "流程图"],
    "系统操作问题": ["系统", "登录", "密码", "操作"],
    "材料与审核问题": ["材料", "审核", "退回"],
    "流程卡点": ["卡住", "流程", "卡点"],
    "找谁问与反馈": ["找谁问", "电话", "办公室", "联系"],
}

ZONE_CATEGORY = {
    "freshman": "新生专区",
    "study": "在校学习专区",
    "aid": "奖助专区",
    "party": "党团专区",
    "life": "生活与证件专区",
    "career": "实习就业与毕业专区",
    "download": "文件专区",
    "faq": "问题专区",
}


def build_knowledge(categories):
    kb = []
    for key, zone in categories.items():
        for item in zone["items"]:
            name = item["name"]
            kw = list(SYNONYMS.get(name, []))
            kw.append(name)
            kb.append({
                "title": name,
                "category": ZONE_CATEGORY.get(key, zone["title"]),
                "url": item["url"],
                "keywords": kw,
            })
    return kb


# ==========================================================
# search-stats.json —— 首页热门关键词
# ==========================================================
def build_search_stats():
    return [
        {"keyword": "请假", "count": 128},
        {"keyword": "报到", "count": 96},
        {"keyword": "奖学金", "count": 88},
        {"keyword": "选课", "count": 79},
        {"keyword": "一卡通", "count": 65},
        {"keyword": "三方协议", "count": 58},
        {"keyword": "宿舍报修", "count": 52},
        {"keyword": "学位申请", "count": 47},
        {"keyword": "助学金", "count": 43},
        {"keyword": "选导", "count": 38},
        {"keyword": "党组织关系", "count": 34},
        {"keyword": "离校", "count": 31},
        {"keyword": "休学", "count": 27},
        {"keyword": "在校证明", "count": 24},
        {"keyword": "专利", "count": 21},
        {"keyword": "团组织关系", "count": 19},
        {"keyword": "学术资源", "count": 16},
        {"keyword": "查重", "count": 14},
    ]


def main():
    if not os.path.isdir(DATA):
        os.makedirs(DATA)

    attachments = copy_attachments()
    print("复制附件 %d 个" % len(attachments))

    downloads = [{
        "title": a["title"],
        "category": a["categoryLabel"],
        "categoryKey": a["category"],
        "file": a["file"],
        "size": a["size"],
        "ext": a["ext"],
    } for a in attachments]
    write_json(os.path.join(DATA, "downloads.json"), downloads)

    categories = build_categories()
    write_json(os.path.join(DATA, "categories.json"), categories)

    kb = build_knowledge(categories)
    write_json(os.path.join(DATA, "knowledge-base.json"), kb)

    write_json(os.path.join(DATA, "search-stats.json"), build_search_stats())

    print("\n完成。专区=%d  子板块=%d  搜索索引=%d  附件=%d"
          % (len(categories),
             sum(len(z["items"]) for z in categories.values()),
             len(kb), len(attachments)))


if __name__ == "__main__":
    main()
