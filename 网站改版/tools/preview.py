# -*- coding: utf-8 -*-
"""
preview.py —— 把「网站改版」的内容生成独立预览站点

只做一件事：在「网站改版/_preview/」生成一份自包含的静态站点，
用浏览器打开 _preview/index.html 即可查看效果。
**不会修改站点根目录的任何文件。**

用法：
    python 网站改版/tools/preview.py
"""
import io
import os
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "网站改版")
PREVIEW = os.path.join(SRC, "_preview")

# 旧页面 → 新页面 的跳转映射（预览里也生成，方便检查跳转）
REDIRECTS = {
    "leave.html": "study.html#leave",
    "internship.html": "career.html#internship",
    "graduation.html": "career.html#degree",
    "other.html": "life.html",
    "notices.html": "notices.html",
}

REDIRECT_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>页面已迁移 | 工学部研究生事务服务中心</title>
    <meta http-equiv="refresh" content="0; url=@@TARGET@@">
    <script>window.location.replace("@@TARGET@@");</script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; margin: 0; background: #f5f5f7; color: #1d1d1f;
        }
        .box { text-align: center; padding: 24px; }
        .box a { color: #0071e3; }
    </style>
</head>
<body>
    <div class="box">
        <p>页面已调整，正在跳转…</p>
        <p><a href="@@TARGET@@">点这里直接前往</a></p>
    </div>
</body>
</html>
"""


def file_hash(path):
    import hashlib
    with io.open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def copy_tree(src, dst):
    """复制目录，跳过内容相同的文件"""
    if not os.path.isdir(src):
        return 0
    count = 0
    for dirpath, _dirnames, filenames in os.walk(src):
        rel = os.path.relpath(dirpath, src)
        target_dir = os.path.join(dst, rel) if rel != "." else dst
        if not os.path.isdir(target_dir):
            os.makedirs(target_dir)
        for fn in filenames:
            s = os.path.join(dirpath, fn)
            d = os.path.join(target_dir, fn)
            if os.path.exists(d) and file_hash(s) == file_hash(d):
                continue
            shutil.copy2(s, d)
            count += 1
    return count


def write_redirects(pages_dir):
    for old, target in REDIRECTS.items():
        path = os.path.join(pages_dir, old)
        html = REDIRECT_TEMPLATE.replace("@@TARGET@@", target)
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(html)
    print("生成跳转页 %d 个" % len(REDIRECTS))


def build():
    # 注意：只删 _preview 自己的目录，绝对不能删 SRC 整个目录
    if os.path.isdir(PREVIEW):
        shutil.rmtree(PREVIEW)
    os.makedirs(PREVIEW)

    n = 0
    for sub in ("pages", "data", "files", "notices", "assets"):
        n += copy_tree(os.path.join(SRC, sub), os.path.join(PREVIEW, sub))

    shutil.copy2(os.path.join(SRC, "index.html"), os.path.join(PREVIEW, "index.html"))
    n += 1

    write_redirects(os.path.join(PREVIEW, "pages"))
    print("预览已生成: 网站改版/_preview/  （%d 个文件）" % n)
    print("用浏览器打开 _preview/index.html 即可查看效果")
    print("提示：站点根目录的文件没有被改动。")


if __name__ == "__main__":
    build()
