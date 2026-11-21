# -*- coding: utf-8 -*-
"""检查生成的页面质量"""
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
PAGES = os.path.join(ROOT, "_preview", "pages")

if not os.path.isdir(PAGES):
    print("还没有预览站点，请先运行 python 网站改版2/tools/make.py")
    raise SystemExit(1)

rows = []
for fn in sorted(os.listdir(PAGES)):
    if not fn.endswith(".html"):
        continue
    p = os.path.join(PAGES, fn)
    with io.open(p, "r", encoding="utf-8") as f:
        t = f.read()

    if 'http-equiv="refresh"' in t:
        continue

    rows.append({
        "file": fn,
        "KB": round(len(t.encode("utf-8")) / 1024, 1),
        "crumb": "Y" if "breadcrumb" in t else "-",
        "nav": "Y" if "pagenav" in t else "-",
        "tbl": len(re.findall(r"<table>", t)),
        "mmd": len(re.findall(r"mermaid-block", t)),
        "ph": len(re.findall(r"todo-placeholder", t)),
        "att": len(re.findall(r'href="\.\./files/', t)),
        "h2": len(re.findall(r'class="guide-block-title"', t)),
    })

hdr = "%-24s %7s %6s %5s %5s %6s %5s %4s" % (
    "文件", "KB", "面包屑", "翻页", "表格", "流程图", "占位", "附件")
print(hdr)
print("-" * len(hdr))
for r in rows:
    print("%-24s %7s %6s %5s %5s %6s %5s %4s" % (
        r["file"], r["KB"], r["crumb"], r["nav"], r["tbl"], r["mmd"], r["ph"], r["att"]))

print("\n共 %d 个页面" % len(rows))
