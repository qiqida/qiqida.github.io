# -*- coding: utf-8 -*-
"""检查预览站点里的链接是否都能访问"""
import io
import os
import re
import sys
from urllib.parse import quote, unquote
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
PREVIEW = os.path.join(ROOT, "_preview")
BASE = "http://localhost:8907"

if not os.path.isdir(PREVIEW):
    print("还没有预览站点，请先运行 python 网站改版2/tools/make.py")
    raise SystemExit(1)


def enc(path):
    """中文与空格要编码"""
    return quote(path.encode("utf-8"))


def check_html(path):
    """返回页面里的所有内部链接"""
    with io.open(path, "r", encoding="utf-8") as f:
        t = f.read()
    return re.findall(r'(?:href|src)="([^"#][^"]*)"', t)


def main():
    # 收集所有页面
    pages = []
    for dirpath, _d, filenames in os.walk(PREVIEW):
        for fn in filenames:
            if fn.endswith(".html"):
                pages.append(os.path.join(dirpath, fn))

    broken = []
    checked = 0
    seen = set()

    for page in pages:
        rel_page = os.path.relpath(page, PREVIEW).replace("\\", "/")
        for link in check_html(page):
            if link.startswith(("http://", "https://", "data:", "mailto:", "javascript:")):
                continue

            target = os.path.normpath(os.path.join(os.path.dirname(rel_page), unquote(link)))
            if target.startswith(".."):
                continue

            # 校验锚点是否存在
            anchor_ok = True
            if "#" in target:
                target, anchor = target.split("#", 1)
                anchor = anchor.strip()
                if anchor:
                    anchor_file = os.path.join(PREVIEW, target.replace("/", os.sep))
                    if os.path.isfile(anchor_file):
                        with io.open(anchor_file, "r", encoding="utf-8") as f:
                            at = f.read()
                        if ('id="%s"' % anchor) not in at:
                            anchor_ok = False
                            broken.append((rel_page, link, "锚点 #%s 不存在" % anchor))
                    else:
                        anchor_ok = False

            if not anchor_ok:
                continue

            key = (rel_page, target)
            if key in seen:
                continue
            seen.add(key)

            # 去掉版本号参数（?v=123456）再拼路径
            clean = target.split("?", 1)[0].split("#", 1)[0]
            full = os.path.join(PREVIEW, clean.replace("/", os.sep))
            if not os.path.exists(full):
                broken.append((rel_page, link, "文件不存在"))
                continue

            checked += 1

    print("检查页面 %d 个，链接 %d 条" % (len(pages), checked))
    if broken:
        print("\n发现 %d 个问题：" % len(broken))
        for p, l, why in broken[:60]:
            print("  [%s] %s  →  %s" % (p, l, why))
        sys.exit(1)
    else:
        print("没有发现问题。")


if __name__ == "__main__":
    main()
