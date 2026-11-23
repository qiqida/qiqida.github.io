# -*- coding: utf-8 -*-
"""
site.py —— 「网站改版2」的站点配置与 front-matter 解析

设计要点
--------
1. **专区（zone）**只在这里定义一次：key / 标题 / 图标 / 简介。
   新增子板块**不需要**改这个文件 —— 只要在 md 里写 front-matter 即可。
2. **子板块（sub-block）**的全部元信息都写在 md 文件头的 front-matter 里：

   ---
   title: 请假与考勤
   desc: 线下请假条与线上出省报备两条线、天数与审批级别
   zone: study
   anchor: leave
   order: 1
   keywords: 请假, 病假, 事假, 外出报备
   ---

   字段说明：
     title     必填。页面大标题，也是搜索索引的主键
     desc      选填。一句话简介，显示在页面标题下方与专区总览卡片上
     zone      必填。归属哪个专区（见 ZONES 里的 key）
     anchor    选填。URL 短名，不填则自动从 title 生成
     order     选填。专区内的排序，小的在前，默认 999
     keywords  选填。额外搜索同义词，逗号分隔
     internal  选填。true = 内部文档，不上线、不进导航、不进搜索
     updated   选填。最后更新日期
3. front-matter 解析用最简格式（每行 `key: value`），不引入 yaml 依赖，
   方便不会写 yaml 的人手改。
"""
import io
import os
import re

# ==========================================================
# 路径
# ==========================================================
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "网站改版2")
SRC = os.path.join(OUT, "内容")
PAGES = os.path.join(OUT, "pages")
DATA = os.path.join(OUT, "data")
FILES = os.path.join(OUT, "files")
ATT_SRC = os.path.join(SRC, "08_文件专区", "附件")
PREVIEW = os.path.join(OUT, "_preview")

# ==========================================================
# 八个专区 + 一个支撑页
#
# 每个专区两个描述字段：
#   brief —— 一句话短介绍，显示在首页卡片上（≤ 16 字，别太长）
#   desc  —— 完整描述，显示在专区总览页的标题下方
# ==========================================================
ZONES = [
    {
        "key": "freshman",
        "inHome": True,
        "title": "新生专区",
        "icon": "🧭",
        "brief": "从报到到上课",
        "desc": "报到、迎新、党团转接、入学教育、培养方案与导师双选",
        "order": 1,
    },
    {
        "key": "study",
        "inHome": True,
        "title": "在校学习专区",
        "icon": "📚",
        "brief": "请假、选课与成绩",
        "desc": "请假与考勤、选课退课、考试与成绩、学籍异动、毕业设计、学术资源",
        "order": 2,
    },
    {
        "key": "aid",
        "inHome": True,
        "title": "奖助专区",
        "icon": "💰",
        "brief": "奖学金与助学金",
        "desc": "奖学金、助学金与助学贷款、困难认定、三助一辅岗位",
        "order": 3,
    },
    {
        "key": "party",
        "inHome": True,
        "title": "党团专区",
        "icon": "🏛️",
        "brief": "党组织与团组织",
        "desc": "党组织关系转接、团组织关系、党员发展、班级与班委",
        "order": 4,
    },
    {
        "key": "life",
        "inHome": True,
        "title": "生活与证件专区",
        "icon": "🏠",
        "brief": "住宿、校园卡与证明",
        "desc": "宿舍、一卡通、网络账号、场地借用、心理医保、学生证与证明",
        "order": 5,
    },
    {
        "key": "career",
        "inHome": True,
        "title": "实习就业与毕业专区",
        "icon": "🎓",
        "brief": "实习、就业到离校",
        "desc": "实习与外出报备、实习证明、三方协议、升学出国、毕业与离校",
        "order": 6,
    },
    {
        "key": "download",
        "inHome": True,
        "title": "文件专区",
        "icon": "📂",
        "brief": "表格与模板下载",
        "desc": "请假条、申请表、证明协议、申请书与总结模板下载",
        "order": 7,
    },
    {
        "key": "faq",
        "inHome": True,
        "title": "问题专区",
        "icon": "❓",
        "brief": "卡住了看这里",
        "desc": "系统操作、材料审核、流程卡点、找谁问与反馈",
        "order": 8,
    },
    {
        "key": "about",
        "title": "关于与联系",
        "icon": "ℹ️",
        "brief": "本站说明与联系方式",
        "desc": "网站说明、咨询方式与办公时间、办事地点指引",
        "order": 9,
    },
]

ZONE_BY_KEY = {z["key"]: z for z in ZONES}

# 首页「常用事务」：学生原话 → 子页面
SCENARIOS = [
    ("我要请假", "在校学习专区", "请假与考勤", "study-leave"),
    ("我要开在读证明 / 成绩单", "生活与证件专区", "在读与成绩证明", "life-certificate"),
    ("我要领奖助 / 交困难认定材料", "奖助专区", "按事项进对应子页", "aid-scholarship"),
    ("我要去实习 / 交外出报备", "实习就业与毕业专区", "实习申请与外出报备", "career-internship"),
    ("我要下载表格", "文件专区", "五类模板索引", "download-leave"),
    ("我卡住了 / 不知道找谁", "问题专区", "流程卡点、找谁问与反馈", "faq-block"),
]


# ==========================================================
# front-matter 解析
# ==========================================================
FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.S)


def parse_front_matter(text):
    """
    拆出 front-matter。

    返回 (meta_dict, body)
      meta_dict  —— 解析出的字段（值都是 str 或 list）
      body      —— 去掉 front-matter 之后的正文
    """
    meta = {}
    m = FM_RE.match(text)
    if not m:
        return meta, text

    for line in m.group(1).split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _sep, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()

        if key == "keywords":
            parts = re.split(r"[,，、]", value)
            meta["keywords"] = [p.strip() for p in parts if p.strip()]
        elif key == "internal":
            meta["internal"] = value.lower() in ("true", "yes", "1", "是")
        else:
            meta[key] = value

    return meta, text[m.end():]


def slugify(text):
    """生成锚点 id / URL 短名：保留中文，去掉标点"""
    s = re.sub(r"[^\w\u4e00-\u9fff\s-]", "", text.strip())
    s = re.sub(r"[\s_]+", "-", s)
    return s.strip("-").lower()


def escape_html(text):
    """HTML 转义"""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def read_text(path):
    """兼容 utf-8 / gbk 编码读取"""
    with io.open(path, "rb") as f:
        raw = f.read()
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb18030"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def write_text(path, text):
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


# ==========================================================
# 内容扫描：找出所有带 front-matter 的 md
# ==========================================================
def scan_content(git_dates=None):
    """
    扫描「内容/」目录，返回所有可用于上线的子板块。

    返回 list of dict:
      {
        "path":     绝对路径
        "rel":      相对「内容/」的路径（用 / 分隔）
        "meta":     front-matter 字典
        "body":     正文
        "title":    标题
        "desc":     简介
        "zone":     专区 key
        "anchor":   URL 短名
        "order":    排序
        "keywords": 关键词列表
        "updated":  最后更新日期
        "url":      pages/<zone>-<anchor>.html
        "zone_url": pages/<zone>.html
      }

    git_dates —— 可选。「仓库相对路径 → 日期」的表（见 githistory.py）。
                传了就用它补 updated，省得手动在每个 md 里写日期。
    """
    items = []
    if not os.path.isdir(SRC):
        return items

    for dirpath, dirnames, filenames in os.walk(SRC):
        # 附件目录不参与正文扫描
        dirnames[:] = [d for d in dirnames if not os.path.join(dirpath, d).endswith("附件")]
        for fn in sorted(filenames):
            if not fn.lower().endswith(".md"):
                continue
            path = os.path.join(dirpath, fn)
            raw = read_text(path)
            meta, body = parse_front_matter(raw)

            if "title" not in meta:
                # 没有 front-matter 的文件不算子板块（通常是内部说明文档）
                continue
            if meta.get("internal"):
                continue

            zone = meta.get("zone", "")
            if zone not in ZONE_BY_KEY:
                print("  [警告] %s 的 zone=%r 不存在，已跳过" % (fn, zone))
                continue

            anchor = meta.get("anchor") or slugify(meta["title"])
            rel = os.path.relpath(path, SRC).replace("\\", "/")

            # 最后更新日期：
            #   1. front-matter 里手写的 updated 优先（最准）
            #   2. 否则用 git 里这个文件最后一次被提交的日期（零维护）
            updated = meta.get("updated", "")
            if not updated and git_dates:
                # git 记录的路径是**仓库根**的相对路径，
                # 所以要从 ROOT 算，不是从 OUT 算。
                repo_rel = os.path.relpath(path, ROOT).replace("\\", "/")
                updated = git_dates.get(repo_rel, "")

            items.append({
                "path": path,
                "rel": rel,
                "meta": meta,
                "body": body,
                "title": meta["title"],
                "desc": meta.get("desc", ""),
                "zone": zone,
                "anchor": anchor,
                "order": int(meta.get("order", "999") or 999),
                "keywords": meta.get("keywords", []),
                "updated": updated,
                "url": "pages/%s-%s.html" % (zone, anchor),
                "zone_url": "pages/%s.html" % zone,
            })

    items.sort(key=lambda x: (ZONE_BY_KEY[x["zone"]]["order"], x["order"], x["title"]))
    return items


def group_by_zone(items):
    """按专区分组，返回 [(zone_dict, [items...]), ...]"""
    groups = []
    for zone in ZONES:
        subs = [i for i in items if i["zone"] == zone["key"]]
        groups.append((zone, subs))
    return groups
