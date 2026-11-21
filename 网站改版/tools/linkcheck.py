# -*- coding: utf-8 -*-
"""检查预览站点里的链接是否都能访问"""
import io
import os
import re
import sys
from urllib.parse import quote, unquote
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PREVIEW = os.path.join(ROOT, "_preview")
BASE = "http://localhost:8907"

# 中文与空格要编码
def enc(path):
    return quote(path.encode("utf-8"))


def check_html(path):
    """返回 (内部链接列表, 附件链接列表)"""
    with io.open(path, "r", encoding="utf-8") as f:
        t = f.read()
    internal = re.findall(r'(?:href|src)="([^"#][^"]*)"', t)
    return internal


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
            # HTTP 验证（只对附件做，避免太慢）
            if target.startswith("files/") or target.endswith((".png", ".jpg", ".pdf", ".doc", ".docx")):
                url = BASE + "/" + enc("网站改版/_preview/" + target)
                try:
                    req = urlopen(url, timeout=10)
                    code = req.getcode()
                    if code != 200:
                        broken.append((rel_page, link, "HTTP %s" % code))
                except HTTPError as e:
                    broken.append((rel_page, link, "HTTP %s" % e.code))
                except URLError as e:
                    broken.append((rel_page, link, "连接失败 %s" % e.reason))

    print("检查页面 %d 个，链接 %d 条" % (len(pages), checked))
    if broken:
        print("\n发现 %d 个问题：" % len(broken))
        for p, l, why in broken[:40]:
            print("  [%s] %s  →  %s" % (p, l, why))
    else:
        print("\n没有发现问题。")


if __name__ == "__main__":
    main()
