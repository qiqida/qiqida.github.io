# -*- coding: utf-8 -*-
"""
placeholders.py —— 自动生成「待填写占位清单」

扫描「内容/」下所有 md（排除内部文档），统计 `【　】` 占位符，
重新生成「内容/00_网站说明/04_待填写占位清单.md」。

用法：
    python 网站改版2/tools/placeholders.py
"""
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
CONTENT = os.path.join(ROOT, "内容")
OUT = os.path.join(CONTENT, "00_网站说明", "04_待填写占位清单.md")

# 内部文档，不统计
INTERNAL = (
    "00_网站说明",
    "01_首页",
    "11_全局功能与维护",
)

# 目录名前缀 → 展示名
DIR_TITLES = {
    "02_新生专区": "02_新生专区",
    "03_在校学习专区": "03_在校学习专区",
    "04_奖助专区": "04_奖助专区",
    "05_党团专区": "05_党团专区",
    "06_生活与证件专区": "06_生活与证件专区",
    "07_实习就业与毕业专区": "07_实习就业与毕业专区",
    "08_文件专区": "08_文件专区",
    "09_问题专区": "09_问题专区",
    "10_关于与联系": "10_关于与联系",
}

# 建议填写顺序：越靠前越优先
PRIORITY = [
    "09_问题专区/04_找谁问与反馈.md",
    "03_在校学习专区/01_请假与考勤.md",
    "10_关于与联系/02_咨询方式与办公时间.md",
    "10_关于与联系/03_办事地点指引.md",
]

HEADER = """---
title: 04_待填写占位清单
zone: internal
anchor: 
order: 999
internal: true
---

# 待填写占位清单（`【　】` 汇总）

> 沿用 `补充.md` 第 6 条：所有不明确的地方先空出来让你填。
> 本表由 `tools/placeholders.py` **自动生成**；`【　】` 就是留给你的空位，**填完把括号删掉即可上线**。
> 统计：**{total} 个占位，分布在 {files} 个文件**。改动 md 后重新跑一次脚本即可刷新本表。

## 怎么给我

按「文件路径 + 字段名 + 内容」发我就行，例如：
「`09_问题专区/04_找谁问与反馈.md`：教务员 张三 / 020-xxxx / 行政楼 305」「`03_在校学习专区/01_请假与考勤.md`：线上入口 = 企业微信 → 学生服务 → 出省报备」。
我按现有对外口吻写回对应 md，不需要你改格式。

## 建议的填写顺序

{priority}

---

"""


def collect():
    """返回 [(目录名, [(文件名, [占位行...]), ...]), ...]"""
    groups = []
    for dir_name in sorted(DIR_TITLES):
        dir_path = os.path.join(CONTENT, dir_name)
        if not os.path.isdir(dir_path):
            continue

        entries = []
        for fn in sorted(os.listdir(dir_path)):
            if not fn.endswith(".md"):
                continue
            path = os.path.join(dir_path, fn)
            with io.open(path, "r", encoding="utf-8") as f:
                lines = f.read().splitlines()

            hits = []
            for ln in lines:
                if re.search(r"【\s*】", ln):
                    # 去掉行首的 markdown 列表符号，保留原样
                    hits.append(ln.strip())

            if hits:
                entries.append((fn, hits))

        if entries:
            groups.append((dir_name, entries))
    return groups


def main():
    groups = collect()

    total = 0
    file_count = 0
    for _dir, entries in groups:
        for _fn, hits in entries:
            total += len(hits)
            file_count += 1

    # 建议填写顺序
    priority_lines = []
    for i, path in enumerate(PRIORITY, 1):
        priority_lines.append("%d. `%s`" % (i, path))
    priority_lines.append("4. 各页「需要你填写」—— 本院具体流程（导师双选、党员发展、答辩、场地借用、校外住宿等）")
    priority_lines.append("5. `08_文件专区` 各索引页 —— 目前缺原件的模板")
    priority_lines.append("6. `10_关于与联系` —— 站名、办公时间、对外邮箱")
    priority = "\n".join(priority_lines)

    out = [HEADER.format(total=total, files=file_count, priority=priority)]

    for dir_name, entries in groups:
        out.append("## %s\n" % dir_name)
        for fn, hits in entries:
            out.append("**`%s/%s`** — %d 项\n" % (dir_name, fn, len(hits)))
            for h in hits:
                out.append("- %s" % h)
            out.append("")

    text = "\n".join(out)

    if not os.path.isdir(os.path.dirname(OUT)):
        os.makedirs(os.path.dirname(OUT))
    with io.open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write(text)

    print("已更新：%s" % os.path.relpath(OUT, ROOT))
    print("共 %d 个占位，分布在 %d 个文件" % (total, file_count))


if __name__ == "__main__":
    main()
