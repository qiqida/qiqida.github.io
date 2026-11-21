# -*- coding: utf-8 -*-
"""检查生成的页面质量"""
import io
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PAGES = os.path.join(ROOT, "_preview", "pages")

rows = []
for fn in sorted(os.listdir(PAGES)):
    if not fn.endswith(".html"):
        continue
    p = os.path.join(PAGES, fn)
    with io.open(p, "r", encoding="utf-8") as f:
        t = f.read()

    rows.append({
        "file": fn,
        "KB": round(len(t.encode("utf-8")) / 1024, 1),
        "toc": "Y" if "guide-toc" in t else "-",
        "tbl": len(re.findall(r"<table>", t)),
        "mmd": len(re.findall(r"mermaid-block", t)),
        "ph": len(re.findall(r"todo-placeholder", t)),
        "att": len(re.findall(r"\.\./files/", t)),
        "h2": len(re.findall(r'class="guide-block-title"', t)),
    })

hdr = "%-18s %7s %4s %5s %5s %5s %5s %4s" % ("文件", "KB", "目录", "表格", "流程图", "占位", "附件", "分块")
print(hdr)
print("-" * len(hdr))
for r in rows:
    print("%-18s %7s %4s %5s %5s %5s %5s %4s" % (
        r["file"], r["KB"], r["toc"], r["tbl"], r["mmd"], r["ph"], r["att"], r["h2"]))
