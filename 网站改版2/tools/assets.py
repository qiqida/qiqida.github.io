# -*- coding: utf-8 -*-
"""
assets.py —— 迁移附件 + 生成 data/ 下的 JSON 配置

1. 把「内容/08_文件专区/附件/」下的附件复制到「网站改版2/files/」，
   按五类目录归档（去掉「0X_」前缀，改为站点用的短名）
2. 生成 data/downloads.json（文件专区清单）
3. 生成 data/categories.json（8 专区 + 子板块，首页卡片用）
4. 生成 data/knowledge-base.json（搜索索引）
   —— 关键词 = 标题 + 标题自动切分 + front-matter 里手写的额外同义词
5. 生成 data/search-stats.json（首页热门关键词）

运行：
    python 网站改版2/tools/assets.py
"""
import io
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import DATA, FILES, OUT, SRC, ZONES, group_by_zone, scan_content  # noqa: E402
from pinyin_util import HAS_PINYIN, to_full, to_initials, write_pinyin_table  # noqa: E402

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

# 文件格式分组。用于文件专区的筛选按钮。
EXT_LABEL = {
    ".doc": "Word 文档",
    ".docx": "Word 文档",
    ".xls": "Excel 表格",
    ".xlsx": "Excel 表格",
    ".pdf": "PDF",
    ".png": "图片",
    ".jpg": "图片",
    ".jpeg": "图片",
}

# 文件格式分组的中文名（用于筛选按钮，一组一个）
EXT_GROUPS = [
    ("word", "Word 文档", [".doc", ".docx"]),
    ("excel", "Excel 表格", [".xls", ".xlsx"]),
    ("pdf", "PDF", [".pdf"]),
    ("image", "图片", [".png", ".jpg", ".jpeg"]),
]


def ext_group(ext):
    """返回文件所属的格式分组 key，找不到返回 'other'"""
    for key, _label, exts in EXT_GROUPS:
        if ext in exts:
            return key
    return "other"


def file_size_text(size):
    """字节数转成人类看得懂的文字"""
    if size < 1024:
        return "%d B" % size
    if size < 1024 * 1024:
        return "%.0f KB" % (size / 1024.0)
    return "%.1f MB" % (size / 1024.0 / 1024.0)


def write_json(path, data):
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2))
    print("wrote:", os.path.relpath(path, OUT))


# ==========================================================
# 1. 附件迁移
# ==========================================================
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


# ==========================================================
# 2. categories.json —— 首页卡片与子板块
# ==========================================================
def build_categories(items):
    """首页 8 张卡片 + 每个专区下的子板块（指向独立子页面）"""
    groups = group_by_zone(items)
    data = {}
    for zone, subs in groups:
        data[zone["key"]] = {
            "title": zone["title"],
            "desc": zone["desc"],
            "icon": zone["icon"],
            "page": "pages/%s.html" % zone["key"],
            "items": [
                {
                    "name": s["title"],
                    "type": "流程",
                    "desc": s["desc"],
                    "url": s["url"],
                }
                for s in subs
            ],
        }
    return data


# ==========================================================
# 3. knowledge-base.json —— 搜索索引
# ==========================================================
SPLIT_CHARS = ["与", "和", "、", "及", "的"]


def split_title(title):
    """
    把标题按「与 / 和 / 、 / 及 / 的」自动切分成额外关键词。

    例：
      "实习申请与外出报备" -> ["实习申请", "外出报备"]
      "实习就业与毕业专区" -> ["实习就业", "毕业专区"]
    """
    parts = [title]
    for ch in SPLIT_CHARS:
        new = []
        for p in parts:
            new.extend(p.split(ch))
        parts = [x.strip() for x in new if x.strip()]

    out = []
    for p in parts:
        if p != title and len(p) >= 2 and p not in out:
            out.append(p)
    return out


def add_pinyin(kb):
    """
    给每条索引补 pinyin / initials 字段。

    pinyin    —— 全拼，如「请假」-> "qing jia"
    initials  —— 首字母，如「请假」-> "qj"

    搜「qj」时能命中「请假」，这是移动端最常见的需求。
    装了 pypinyin 才生成；没装则跳过，不影响其它功能。
    """
    if not HAS_PINYIN:
        print("  [提示] 没装 pypinyin，搜索索引不含拼音（装一下即可支持 qj 搜请假）")
        return kb

    for item in kb:
        # 只对标题和关键词转拼音，正文不参与（避免索引过大）
        words = [item.get("title", "")] + list(item.get("keywords", []))
        full = []
        initials = []
        for w in words:
            if not w:
                continue
            py = to_full(w)
            ini = to_initials(w)
            if py:
                full.append("".join(py))
            if ini:
                initials.append("".join(ini))
        item["pinyin"] = " ".join(dict.fromkeys(full))
        item["initials"] = " ".join(dict.fromkeys(initials))

    return kb


def build_knowledge(items):
    """
    搜索索引。

    收录三类页面：
      1. 子板块页（49 个）—— 主要搜索目标
      2. 专区总览页（9 个）—— 搜「实习就业与毕业专区」这类专区名时能命中
      3. 通知详情页（3 个）—— 搜通知标题时能命中
    """
    kb = []

    # --- 1. 专区总览页 ---
    for zone in ZONES:
        kw = [zone["title"]]
        # 专区名里的「与」「和」也切一次，例：实习就业与毕业专区 -> 实习就业 / 毕业专区
        for p in split_title(zone["title"]):
            if p not in kw:
                kw.append(p)
        if zone.get("brief") and zone["brief"] not in kw:
            kw.append(zone["brief"])
        kb.append({
            "title": zone["title"],
            "category": "专区总览",
            "url": "pages/%s.html" % zone["key"],
            "desc": zone.get("desc", ""),
            "keywords": kw,
        })

    # --- 2. 子板块页 ---
    for zone, subs in group_by_zone(items):
        for s in subs:
            kw = []
            # 1. 标题自动切分
            kw.extend(split_title(s["title"]))
            # 2. front-matter 里手写的额外同义词
            for k in s["keywords"]:
                if k not in kw:
                    kw.append(k)
            # 3. 标题本身放最后
            kw.append(s["title"])

            kb.append({
                "title": s["title"],
                "category": zone["title"],
                "url": s["url"],
                "desc": s["desc"],
                "keywords": kw,
            })

    # --- 3. 通知详情页 ---
    notices_path = os.path.join(DATA, "notices.json")
    if os.path.exists(notices_path):
        with io.open(notices_path, "r", encoding="utf-8") as f:
            notices = json.load(f)
        for n in notices:
            kw = []
            for p in split_title(n.get("title", "")):
                if p not in kw:
                    kw.append(p)
            if n.get("title"):
                kw.append(n["title"])
            kb.append({
                "title": n.get("title", ""),
                "category": "重要通知",
                "url": "pages/notice-%s.html" % n.get("id", ""),
                "desc": n.get("summary", ""),
                "keywords": kw,
            })

    return kb


# ==========================================================
# 4. search-stats.json —— 首页「常见搜索词」
# ==========================================================
# 说明：
#   这里只给「常见搜索词」，**不标搜索次数**。
#   之前的版本写死了 count（128/96/88…），那些数字是编的，
#   学生点进去发现搜不到对应内容会降低对站点的信任。
#
#   选取标准：覆盖八个专区里最高频的那几件事，
#   并且保证每个词在站内**确实搜得到东西**。
#
#   以后想改这一组词，直接改这个列表即可。
COMMON_SEARCH_WORDS = [
    # 新生
    "报到", "迎新", "选导", "入学教育",
    # 在校学习
    "请假", "出省", "选课", "退课", "考试", "成绩", "休学", "保留学籍",
    # 奖助
    "奖学金", "助学金", "困难认定", "助学贷款", "三助",
    # 党团
    "党组织关系", "团组织关系", "党员发展", "班委",
    # 生活与证件
    "一卡通", "校园卡", "宿舍报修", "退宿", "校外住宿", "学生证", "在读证明",
    # 实习就业与毕业
    "实习", "三方协议", "就业推荐", "毕业资格", "学位申请", "答辩", "离校",
    # 文件
    "申请表", "请假条", "证明", "流程图",
]


def build_search_stats():
    """返回常见搜索词列表（不带次数）"""
    return [{"keyword": k} for k in COMMON_SEARCH_WORDS]


# ==========================================================
# 4b. site-stats.json —— 首页「站点内容」的真实数字
# ==========================================================
def build_site_stats(items, attachments):
    """
    首页展示的四个数字，全部是**站内实际有多少**，不是编的。

    files   可下载资料数（附件个数）
    pages   流程页面数（子板块 + 专区总览）
    zones   事务专区数（首页卡片区那 8 个，不含「关于与联系」）
    faq     常见问题数（data/faq.json 里的条数）

    访问量不放这儿 —— 那个要看 Google Analytics，
    站内算不出来，与其写个假数字不如不写。
    """
    pages = len(items) + len(ZONES)

    # 首页卡片区只有 8 个专区，「关于与联系」不在里面，
    # 所以这里按首页口径来数，别显示成 9。
    homepage_zones = [z for z in ZONES if z.get("inHome")]
    zone_count = len(homepage_zones) if homepage_zones else len(ZONES) - 1

    faq_count = 0
    faq_path = os.path.join(DATA, "faq.json")
    if os.path.exists(faq_path):
        try:
            with io.open(faq_path, "r", encoding="utf-8") as f:
                faq_data = json.load(f)
            if isinstance(faq_data, list):
                faq_count = len(faq_data)
            elif isinstance(faq_data, dict):
                faq_count = len(faq_data.get("items", []))
        except Exception:
            faq_count = 0

    return {
        "files": len(attachments),
        "pages": pages,
        "zones": zone_count,
        "faq": faq_count,
    }


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
        "sizeText": file_size_text(a["size"]),
        "ext": a["ext"],
        "extLabel": EXT_LABEL.get(a["ext"], a["ext"].lstrip(".").upper() or "文件"),
        "extGroup": ext_group(a["ext"]),
    } for a in attachments]

    # 拼音索引：让文件浏览器支持 qjtsq → 请假条申请表 这类搜索
    if HAS_PINYIN:
        for d in downloads:
            words = [d["title"], d["category"]]
            ini = []
            for w in words:
                letters = to_initials(w)
                if letters:
                    ini.append("".join(letters))
            d["initials"] = " ".join(dict.fromkeys(ini))
    else:
        for d in downloads:
            d["initials"] = ""

    write_json(os.path.join(DATA, "downloads.json"), downloads)

    items = scan_content()
    categories = build_categories(items)
    write_json(os.path.join(DATA, "categories.json"), categories)

    kb = build_knowledge(items)
    kb = add_pinyin(kb)
    write_json(os.path.join(DATA, "knowledge-base.json"), kb)

    # 拼音对照表（前端搜索用）
    write_pinyin_table()

    write_json(os.path.join(DATA, "search-stats.json"), build_search_stats())

    # 站点内容统计（都是真实数字，不是编的）
    write_json(os.path.join(DATA, "site-stats.json"), build_site_stats(items, attachments))

    print("\n完成。专区=%d  子板块=%d  搜索索引=%d  附件=%d"
          % (len(categories),
             sum(len(z["items"]) for z in categories.values()),
             len(kb), len(attachments)))


if __name__ == "__main__":
    main()
