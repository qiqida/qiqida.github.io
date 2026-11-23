# -*- coding: utf-8 -*-
"""
schema.py —— 生成 JSON-LD 结构化数据

为什么需要：
    搜索引擎（尤其 Google）会读 JSON-LD，把页面内容理解成
    「问答」「步骤说明」「面包屑」这类结构化信息。
    拿对了能进富结果摘要（搜索结果里直接显示答案和步骤），
    拿错了就是普通的蓝链接，点击率差一大截。

本模块给三类页面生成结构化数据：

  1. **所有页面**     WebPage + BreadcrumbList
     —— 面包屑让搜索结果显示「首页 > 在校学习专区 > 请假与考勤」

  2. **含问答的页面**  FAQPage
     —— 页面里凡是「Q：… A：…」的段落，收进 FAQPage
     —— 首页热门问题那 6 条也是 FAQ（走 faq.json）

  3. **含流程图的页面** HowTo
     —— md 里的 ```mermaid flowchart``` 会被解析成有序步骤
     —— 这是「怎么一步步办」页面的最佳结构化类型

设计原则：
    · 只生成**页面上真的能看到**的内容，不编造。
      搜索引擎会核对「结构化数据里写了什么」和「页面上有没有」，
      对不上会被判作弊，代价远大于收益。
    · 解析不到就干脆不生成这个类型，只保留 WebPage + Breadcrumb。
    · 纯 Python 生成，不引第三方依赖。
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from siteconf import escape_html, read_text  # noqa: E402

SITE_BASE = "https://qiqida.github.io"
SITE_NAME = "工学部研究生事务服务中心"


# ==========================================================
# 工具
# ==========================================================
def _json_dump(data):
    """生成安全的 JSON-LD 文本

    用 ensure_ascii=False 让中文可读（不影响解析）。
    同时转义 </script>，防止 JSON 里的字符串提前闭合 script 标签。
    """
    text = json.dumps(data, ensure_ascii=False, indent=2)
    # JSON-LD 放在 <script type="application/ld+json"> 里，
    # 如果内容含 </script> 会提前闭合标签，页面结构就坏了。
    return text.replace("</", "<\\/")


def _absolute(url):
    """相对路径转绝对地址。JSON-LD 里必须用绝对地址。"""
    if not url:
        return SITE_BASE + "/"
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return SITE_BASE + "/" + url.lstrip("/")


# ==========================================================
# 1. 面包屑
# ==========================================================
def build_breadcrumb_ld(zone_title, page_title, url_path, zone_key=""):
    """BreadcrumbList —— 面包屑

    结构：首页 > 专区 > 当前页
    专区总览页和通知页只有两层（首页 > 当前页）。

    zone_key 是专区的英文 key（如 "study"），
    用来拼专区的真实地址 —— 不能用中文标题当文件名。
    """
    elements = [{
        "@type": "ListItem",
        "position": 1,
        "name": "首页",
        "item": SITE_BASE + "/",
    }]

    position = 2
    if zone_title:
        elements.append({
            "@type": "ListItem",
            "position": position,
            "name": zone_title,
            "item": SITE_BASE + "/pages/%s.html" % (zone_key or ""),
        })
        position += 1

    elements.append({
        "@type": "ListItem",
        "position": position,
        "name": page_title,
        "item": _absolute(url_path),
    })

    return {
        "@type": "BreadcrumbList",
        "@id": _absolute(url_path) + "#breadcrumb",
        "itemListElement": elements,
    }


# ==========================================================
# 2. 问答（FAQPage）
# ==========================================================
# md 里的问答长这样：
#   **Q：学宿费怎么交？**（原「新生专区」）
#   A：校园统一支付平台 ...
#
# 也支持更松的写法：
#   Q: 学宿费怎么交？
#   A: ...

_QA_PAIR_RE = re.compile(
    r"^\s*(?:\*\*)?Q\s*[：:]\s*(.+?)\s*(?:\*\*)?\s*$(?P<q_end>.*?)$",
    re.M,
)


def parse_qa_pairs(body):
    """
    从 md 正文里抽出问答对。

    返回 [(问题, 答案), ...]，抽不到就是空列表。

    识别规则（有意做得保守，避免把正文里的普通问句误判成问答）：
      · 问答必须在**连续的段落**里 —— Q 段后面紧跟 A 段
      · Q 段以「Q：」或「**Q：」开头
      · A 段以「A：」或「A:」开头
      · 最多解析前 12 条（再多搜索引擎也不全展示）
    """
    pairs = []
    lines = body.replace("\r\n", "\n").split("\n")

    i = 0
    while i < len(lines) and len(pairs) < 12:
        line = lines[i].strip()

        # 找 Q 行
        # 注意末尾的 ** 可能紧贴问题文字（**Q：学宿费怎么交？**），
        # 所以问题文字要允许非贪婪匹配，让最后的 ** 落到外面。
        m = re.match(r"^(?:\*\*)?Q\s*[：:]\s*(.+?)\s*\*?\*?\s*$", line)
        if not m:
            i += 1
            continue

        question = m.group(1).strip()
        # 去掉 Q 行尾部的来源标注，比如「（原「新生专区」）」
        question = re.sub(r"（原[「『].*?[」』]）\s*$", "", question).strip()
        question = re.sub(r"\(原.*?\)\s*$", "", question).strip()
        # 去掉残留的加粗标记
        question = question.replace("**", "").strip()

        # 找紧接着的 A 段（允许中间隔一个空行）
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j >= len(lines):
            break

        a_line = lines[j].strip()
        am = re.match(r"^(?:\*\*)?A\s*[：:]\s*(.+?)\s*\*?\*?\s*$", a_line)
        if not am:
            i += 1
            continue

        answer = am.group(1).strip().replace("**", "").strip()

        # 答案如果被拆成多段（后续行不以 Q 开头且非空），继续接上
        k = j + 1
        while k < len(lines):
            nxt = lines[k].strip()
            if not nxt:
                break
            if re.match(r"^(?:\*\*)?[QA]\s*[：:]", nxt):
                break
            if nxt.startswith(("#", "-", "*", "|", ">")):
                break
            answer += " " + nxt
            k += 1

        if question and answer:
            pairs.append((question, answer))

        i = k if k > j else j + 1

    return pairs


def build_faq_ld(pairs, url_path):
    """FAQPage —— 问答页

    搜索引擎会把这些问答显示成可展开的「常见问题」富结果。
    """
    if not pairs:
        return None

    return {
        "@type": "FAQPage",
        "@id": _absolute(url_path) + "#faq",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": a,
                },
            }
            for q, a in pairs
        ],
    }


# ==========================================================
# 3. 步骤（HowTo）
# ==========================================================
# mermaid 流程图长这样：
#   flowchart LR
#       A[本人填写请假条] --> B[导师签字]
#       B --> C[辅导员签字]
#
# 解析成步骤：本人填写请假条 → 导师签字 → 辅导员签字

_MERMAID_BLOCK_RE = re.compile(r"```mermaid\s*\n(.*?)```", re.S)


def parse_flow_steps(body):
    """
    从 md 的 mermaid 流程图里解析出有序步骤。

    返回 [(步骤名, 说明), ...]，抽不到就是空列表。

    只认 flowchart（TD / LR 都行），timeline 不算步骤。
    支持 A[文字] / A[文字]{某} / A(圆角) / A{菱形} 几种写法。
    """
    steps = []

    for block in _MERMAID_BLOCK_RE.findall(body):
        if "flowchart" not in block and "graph" not in block:
            continue

        seen = set()
        for line in block.split("\n"):
            line = line.strip()
            if not line or line.startswith("flowchart") or line.startswith("graph"):
                continue
            if "-->" not in line and "---" not in line:
                continue

            # 一行里可能有多个节点：A[x] --> B[y] --> C[z]
            # 只取每个节点的显示文字，按出现顺序去重。
            for raw in re.findall(r"\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\}", line):
                text = (raw[0] or raw[1] or raw[2] or "").strip()
                if not text:
                    continue
                # 去掉引号和多余空白
                text = text.replace('"', "").strip()
                if not text or text in seen:
                    continue
                seen.add(text)
                steps.append((text, ""))

    return steps[:20]  # 步骤太多反而没用


def build_howto_ld(title, desc, steps, url_path):
    """HowTo —— 办事流程

    步骤来自页面上的流程图，和页面上看到的一致。
    """
    if not steps:
        return None

    return {
        "@type": "HowTo",
        "@id": _absolute(url_path) + "#howto",
        "name": title,
        "description": desc,
        "totalTime": "P30D",   # 没法准确算，给个「一个月内」的保守值
        "step": [
            {
                "@type": "HowToStep",
                "position": i + 1,
                "name": name,
                "text": desc_text or name,
            }
            for i, (name, desc_text) in enumerate(steps)
        ],
    }


# ==========================================================
# 4. 组装
# ==========================================================
def build_page_ld(page_title, desc, url_path, zone_title="",
                  body="", qa_pairs=None, zone_key=""):
    """
    给一个页面生成全部 JSON-LD 片段，返回一个 list。

    page_title  页面标题
    desc        页面简介
    url_path    页面在站点根下的相对路径，如 "pages/study-leave.html"
    zone_title  所属专区标题（用于面包屑中间层）
    zone_key    所属专区 key（面包屑里拼地址用）
    body        md 原文（用来解析问答和流程步骤）
    qa_pairs    已解析好的问答（可选，避免重复解析）
    """
    lds = []

    # --- WebPage（所有页面都有）---
    webpage = {
        "@type": "WebPage",
        "@id": _absolute(url_path) + "#webpage",
        "url": _absolute(url_path),
        "name": page_title,
        "description": desc,
        "isPartOf": {
            "@type": "WebSite",
            "@id": SITE_BASE + "/",
            "name": SITE_NAME,
            "url": SITE_BASE + "/",
        },
        "inLanguage": "zh-CN",
    }
    lds.append(webpage)

    # --- BreadcrumbList（所有页面都有）---
    lds.append(build_breadcrumb_ld(zone_title, page_title, url_path, zone_key))

    # --- FAQPage（有问答才有）---
    pairs = qa_pairs if qa_pairs is not None else parse_qa_pairs(body or "")
    faq = build_faq_ld(pairs, url_path)
    if faq:
        lds.append(faq)

    # --- HowTo（有流程步骤才有）---
    steps = parse_flow_steps(body or "")
    howto = build_howto_ld(page_title, desc, steps, url_path)
    if howto:
        lds.append(howto)

    return lds


def render_ld_script(lds):
    """把 JSON-LD 列表渲染成 <script> 标签。

    多个类型合并到一个 @graph 里，搜索引擎更推荐这种写法。
    """
    if not lds:
        return ""

    graph = {
        "@context": "https://schema.org",
        "@graph": lds,
    }
    return ('<script type="application/ld+json">\n%s\n</script>' % _json_dump(graph))


# ==========================================================
# 自测：python schema.py
# ==========================================================
if __name__ == "__main__":
    # 找一个真实的 md 试试
    here = os.path.abspath(os.path.join(HERE, ".."))
    sample = os.path.join(here, "内容", "03_在校学习专区", "01_请假与考勤.md")
    if os.path.exists(sample):
        raw = read_text(sample)
        from siteconf import parse_front_matter
        meta, body = parse_front_matter(raw)
        lds = build_page_ld(
            meta.get("title", ""),
            meta.get("desc", ""),
            "pages/study-leave.html",
            zone_title="在校学习专区",
            body=body,
        )
        print(render_ld_script(lds))
    else:
        print("找不到示例文件：%s" % sample)
