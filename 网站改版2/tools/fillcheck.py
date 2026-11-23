# -*- coding: utf-8 -*-
"""
fillcheck.py —— 生成「可对照填写」的占位清单（人读友好版）

为什么不用 placeholders.py 生成的表
----------------------------------
那个表是**给机器看**的：把含 `【　】` 的行原样抄一遍。
问题是：

  1. 一行里有多个 `【　】` 时，分不清哪个对应哪个字段
  2. 裸占位（`- 【　】`）看不出是问什么
  3. 没有编号，没法在对话里说「第 3 条填 xxx」
  4. 没有「这条占位属于哪个小节」的上下文

这个脚本生成的表**每条占位一行**，带：
  · 全局编号（S001、S002……）—— 你可以直接说「S012 填 xxx」
  · 所属小节（最近的标题）
  · 要填什么（字段名 / 表格列名）
  · 原始行号（方便定位）

特殊处理：
  · **表格行**——一整行只算 1 条，并把表头列名带出来
    （表格里一行往往有 3~5 个空位，拆开就没法填了）
  · **说明性文字**——像「`【　】` 为待填写项」这种不算真占位，排除

用法：
    python 网站改版2/tools/fillcheck.py            # 生成清单
    python 网站改版2/tools/fillcheck.py --summary  # 只看统计
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
CONTENT = os.path.join(ROOT, "内容")
OUT = os.path.join(CONTENT, "00_网站说明", "05_待填写清单（可直接对照填）.md")

# 内部文档，不统计
INTERNAL_DIRS = ("00_网站说明", "01_首页", "11_全局功能与维护")

# 目录顺序 = 建议填写顺序（最急的在前）
DIR_ORDER = [
    "09_问题专区",
    "03_在校学习专区",
    "02_新生专区",
    "04_奖助专区",
    "05_党团专区",
    "06_生活与证件专区",
    "07_实习就业与毕业专区",
    "10_关于与联系",
    "08_文件专区",
]

PLACEHOLDER = re.compile(r"【\s*】")
# 反引号包裹的 `【　】` 是在**说明**这个占位符本身，不是要填的空位
PLACEHOLDER_IN_CODE = re.compile(r"`\s*【\s*】\s*`")
HEADING = re.compile(r"^(#{1,6})\s+(.*)$")

# 说明性文字：提到 `【　】` 但不是在填空
EXPLAIN_PATTERNS = [
    re.compile(r"为待填写项"),
    re.compile(r"待你填写"),
    re.compile(r"填完(把)?括号"),
    re.compile(r"待填写空位"),
    re.compile(r"汇总见"),
    re.compile(r"占位符"),
]


def is_explanation(text):
    """这一行是不是在解释占位符本身（而不是真的需要填）"""
    for pat in EXPLAIN_PATTERNS:
        if pat.search(text):
            return True
    return False


def real_placeholder_count(line):
    """这一行有几个**真**占位（排除反引号包裹的说明）"""
    stripped = PLACEHOLDER_IN_CODE.sub("", line)
    return len(PLACEHOLDER.findall(stripped))


def strip_md(text):
    """去掉行首的列表符号、表格竖线等，只留正文字符"""
    t = text.strip()
    t = re.sub(r"^[-*+]\s+", "", t)
    t = re.sub(r"^#+\s+", "", t)
    t = t.strip()
    t = t.strip("|").strip()
    return t


def find_section(lines, idx):
    """往上找最近的标题，作为这条占位的所属小节"""
    for i in range(idx, -1, -1):
        m = HEADING.match(lines[i].strip())
        if m:
            level = len(m.group(1))
            # 只要 2 级和 3 级标题（## 和 ###），太粗的不够定位
            if 2 <= level <= 3:
                return m.group(2).strip()
    return ""


def table_header(lines, idx):
    """如果是表格行，往上找表头，返回列名列表；不是表格返回 None

    关键：从当前行往上找**最近的那个** `|---|---|` 分隔行，
    再取它上面一行的表头。如果找错了（拿到上一张表的表头），
    后面会用列数对一下，对不上就返回 None。
    """
    line = lines[idx].strip()
    if not line.startswith("|"):
        return None

    # 往上找分隔行 |---|---|
    sep_idx = None
    for i in range(idx - 1, max(idx - 30, -1), -1):
        s = lines[i].strip()
        if s.startswith("|") and re.match(r"^\|[\s:\-|]+\|$", s):
            sep_idx = i
            break
    if sep_idx is None or sep_idx == 0:
        return None

    header_line = lines[sep_idx - 1].strip()
    if not header_line.startswith("|"):
        return None

    cols = [c.strip() for c in header_line.strip("|").split("|")]

    # 列数必须和这一行对得上，否则说明找错表头了
    n_cells = len(line.strip("|").split("|"))
    if len(cols) != n_cells:
        return None

    return cols


def describe_table_row(line, cols):
    """表格行：把每个空位对应的列名列出来"""
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    fields = []
    for i, cell in enumerate(cells):
        if not PLACEHOLDER.search(cell):
            continue
        col = cols[i] if i < len(cols) else "第%d列" % (i + 1)
        fields.append(col)

    # 已经填了值的格子，说明这行的意思是那个
    filled = [c for c in cells if c and not PLACEHOLDER.search(c)]
    hint = ""
    if filled:
        hint = "（这一行已填：%s）" % "、".join(filled[:3])

    return "、".join(fields) + hint


def guess_question(line, prev_line=None):
    """猜这条占位在问什么（只处理非表格行）

    prev_line：上一行非空内容，用来给裸占位补上下文。
    """
    text = strip_md(line)

    # 行末是 `xxx：【　】` 或 `（xxx：【　】）`
    #
    # 字段名里可能含括号（如「各系统报错的对照表（报错提示 → 原因 → 处理）」），
    # 所以这里用「最后一个冒号」来切，不能排除括号字符。
    # 末尾可能还有句号、逗号等，一并吃掉。
    m = re.search(r"^(.{2,60}?)[：:]\s*【\s*】\s*[）)]?\s*[。，,、；;]?\s*$", text)
    if m:
        label = m.group(1).strip()
        label = re.sub(r"^(和|与|及|或)\s*", "", label)
        # 只去掉**包裹式**的括号：整个标签被一对括号包住时才去掉，
        # 像「系统 / 入口（网址、小程序）」这种括号是内容的一部分，要保留。
        if len(label) > 2 and label[0] in "（(" and label[-1] in "）)":
            label = label[1:-1].strip()
        if label:
            return label

    # 整行就是 `- 【　】` —— 没有字段名，靠上下文
    if text.strip("【　】").strip() in ("-", "", "- "):
        # 上一行是个标题或短句 → 用它当提示
        if prev_line:
            p = strip_md(prev_line)
            # 上一行是「## 找谁问」这种 → 拿标题当问题
            if p and len(p) <= 30:
                return "%s（这一段要写什么？）" % p
        return ""

    # `- 【　】（哪些年级、哪些专业…）` 这种括号注释
    m2 = re.search(r"【\s*】\s*[（(]([^）)]{2,60})[）)]", text)
    if m2:
        return m2.group(1).strip()

    # 整行就是一个孤零零的 `【　】`（段落级占位）
    if text == "【　】" and prev_line:
        p = strip_md(prev_line)
        if p and len(p) <= 40:
            return "%s（这一段要写什么？）" % p

    return ""


def collect():
    """返回 [{dir, file, items: [{no, line_no, section, question, raw, kind}]}]"""
    groups = []
    seq = 0

    for dir_name in DIR_ORDER:
        dir_path = os.path.join(CONTENT, dir_name)
        if not os.path.isdir(dir_path):
            continue

        for fn in sorted(os.listdir(dir_path)):
            if not fn.endswith(".md"):
                continue
            path = os.path.join(dir_path, fn)
            with io.open(path, "r", encoding="utf-8") as f:
                lines = f.read().splitlines()

            items = []
            for idx, ln in enumerate(lines):
                n_in_line = real_placeholder_count(ln)
                if n_in_line == 0:
                    continue
                if is_explanation(ln):
                    continue

                cols = table_header(lines, idx)

                if cols:
                    # 表格行：整行算 1 条
                    seq += 1
                    items.append({
                        "no": "S%03d" % seq,
                        "line_no": idx + 1,
                        "section": find_section(lines, idx),
                        "question": describe_table_row(ln, cols),
                        "raw": ln.strip(),
                        "kind": "table",
                    })
                else:
                    # 普通行：一行里的多个占位分别算
                    # 但如果是「xxx：【　】、yyy：【　】」这种同名字段，
                    # 还是拆开更好定位
                    prev = None
                    for k in range(n_in_line):
                        # 找上一行非空内容
                        if prev is None:
                            for j in range(idx - 1, -1, -1):
                                if lines[j].strip():
                                    prev = lines[j]
                                    break
                        seq += 1
                        items.append({
                            "no": "S%03d" % seq,
                            "line_no": idx + 1,
                            "section": find_section(lines, idx),
                            "question": guess_question(ln, prev),
                            "raw": ln.strip(),
                            "kind": "line",
                            "multi": n_in_line > 1,
                        })

            if items:
                groups.append({
                    "dir": dir_name,
                    "file": fn,
                    "items": items,
                })

    return groups


def build_markdown(groups):
    total = sum(len(g["items"]) for g in groups)
    out = []
    out.append("---")
    out.append("title: 05_待填写清单（可直接对照填）")
    out.append("zone: internal")
    out.append("anchor: ")
    out.append("order: 999")
    out.append("internal: true")
    out.append("---")
    out.append("")
    out.append("# 待填写清单（可直接对照填）")
    out.append("")
    out.append("> 本表由 `tools/fillcheck.py` **自动生成**，覆盖全部 `%d` 处 `【　】`。" % total)
    out.append(">")
    out.append("> **怎么用**：照着编号回我内容就行，比如")
    out.append("> 「S012：企业微信 → 学生服务 → 出省报备」「S030：2026-09-01 至 2026-09-15」。")
    out.append("> 我按现有对外口吻写回对应 md。")
    out.append("> **你也可以自己直接改 md**，改完跑一次 `python 网站改版2/tools/make.py` 就能上线。")
    out.append("")
    out.append("**标记说明**")
    out.append("")
    out.append("| 标记 | 含义 |")
    out.append("|---|---|")
    out.append("| ⚠️ | **没有字段名** —— 需要看原文上下文才知道问什么 |")
    out.append("| 🔁 | 这一行有多个 `【　】`，需要你按顺序分别给 |")
    out.append("| 📋 | 表格行 —— 整行一起填，列名已标出 |")
    out.append("")
    out.append("---")
    out.append("")

    out.append("## 一、速览：按文件看数量")
    out.append("")
    out.append("| 文件 | 待填条数 |")
    out.append("|---|---|")
    for g in groups:
        out.append("| `%s/%s` | %d |" % (g["dir"], g["file"], len(g["items"])))
    out.append("| **合计** | **%d** |" % total)
    out.append("")
    out.append("---")
    out.append("")

    out.append("## 二、逐条清单")
    out.append("")
    for g in groups:
        out.append("### `%s/%s`" % (g["dir"], g["file"]))
        out.append("")
        for it in g["items"]:
            tags = []
            if it.get("multi"):
                tags.append("🔁")
            if it.get("kind") == "table":
                tags.append("📋")
            if not it["question"]:
                tags.append("⚠️")

            tag = (" " + "".join(tags)) if tags else ""

            out.append("**%s**%s" % (it["no"], tag))
            if it["section"]:
                out.append("- 所属小节：%s" % it["section"])
            if it["question"]:
                out.append("- 要填什么：%s" % it["question"])
            else:
                out.append("- 要填什么：**看原文这一行** → `%s`" % it["raw"])
            out.append("- 位置：第 %d 行" % it["line_no"])
            out.append("")
        out.append("---")
        out.append("")

    return "\n".join(out)


def main():
    groups = collect()
    total = sum(len(g["items"]) for g in groups)
    bare = sum(
        1 for g in groups for it in g["items"] if not it["question"]
    )
    tables = sum(
        1 for g in groups for it in g["items"] if it.get("kind") == "table"
    )

    if "--summary" in sys.argv:
        print("待填条数：%d" % total)
        print("  表格行：%d" % tables)
        print("  无字段名：%d" % bare)
        print("涉及文件：%d" % len(groups))
        print()
        for g in groups:
            b = sum(1 for it in g["items"] if not it["question"])
            print("  %-44s %3d 条%s" % (
                "%s/%s" % (g["dir"], g["file"]),
                len(g["items"]),
                ("  (%d 无字段名)" % b) if b else "",
            ))
        return

    text = build_markdown(groups)
    with io.open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write(text)

    print("已生成：%s" % os.path.relpath(OUT, ROOT))
    print("共 %d 条，占 %d 个文件" % (total, len(groups)))
    print("  表格行 %d 条，无字段名 %d 条" % (tables, bare))


if __name__ == "__main__":
    main()
