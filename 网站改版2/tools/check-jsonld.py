# -*- coding: utf-8 -*-
"""校验所有页面里的 JSON-LD 结构化数据是不是合法 JSON。"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "pages")

PATTERN = re.compile(
    r'<script type="application/ld\+json">(.*?)</script>', re.S
)

files = []
for name in sorted(os.listdir(OUT)):
    if name.endswith(".html"):
        files.append(os.path.join(OUT, name))
idx = os.path.join(ROOT, "index.html")
if os.path.exists(idx):
    files.append(idx)

bad = []
types = {}
total = 0

for path in files:
    text = io.open(path, encoding="utf-8").read()
    blocks = PATTERN.findall(text)
    for i, block in enumerate(blocks):
        total += 1
        try:
            data = json.loads(block)
        except Exception as exc:
            bad.append((os.path.basename(path), i, str(exc)))
            continue
        # 顺手统计每种 schema 出现的次数
        for node in data.get("@graph", [data]):
            t = node.get("@type")
            if isinstance(t, list):
                for x in t:
                    types[x] = types.get(x, 0) + 1
            elif t:
                types[t] = types.get(t, 0) + 1

print("检查页面数:", len(files))
print("JSON-LD 块数:", total)
print("非法块:", len(bad))
for item in bad[:20]:
    print("  ", item)
print("--- schema 类型统计 ---")
for k in sorted(types, key=lambda x: -types[x]):
    print("  %-18s %d" % (k, types[k]))

sys.exit(1 if bad else 0)
