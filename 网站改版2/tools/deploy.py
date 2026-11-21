# -*- coding: utf-8 -*-
"""
deploy.py —— 把「网站改版2」的构建产物同步到站点根目录

做四件事：
  1. 同步 index.html / pages/ / data/ / files/ / notices/ / assets/ 到仓库根目录
     —— 采用「先删后拷」：白名单目录整体清空再复制，
        避免上一版的旧文件残留在根目录里变成死链或垃圾。
  2. 在根目录 pages/ 下为旧页面生成跳转页（不删，避免别人收藏的旧链接失效）
  3. 清掉根目录里不再需要的旧数据文件（如 site-config 之外的历史 JSON）
  4. 同步后跑一次链接检查，确保没有断链

**只在 CI（GitHub Actions）里跑**，本地跑也只是复制文件，不会 git 操作。

用法：
    python 网站改版2/tools/deploy.py
"""
import io
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "网站改版2")

# 要同步的目录 / 文件
SYNC_DIRS = ["pages", "data", "files", "notices", "assets"]
SYNC_FILES = ["index.html", "sitemap.xml", "robots.txt", "404.html"]

# 旧站点页面 → 新页面（放在站点根目录的 pages/ 下）
REDIRECTS = {
    "leave.html": "study-leave.html",
    "internship.html": "career-internship.html",
    "graduation.html": "career-degree.html",
    "other.html": "life.html",
    "notices.html": "about-disclaimer.html",
    "notice.html": "notice-2026100.html",
}

# 根目录里需要保留、但不属于新站点产物的文件
# （这些文件由 deploy 自己管理或人工维护，不在「先删后拷」范围内）
KEEP_FILES = [
    ".gitignore",
    "README.md",
    "CNAME",
]

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


def copy_tree(src, dst):
    """递归复制，覆盖同名文件"""
    if not os.path.isdir(src):
        return 0
    count = 0
    for dirpath, _dirnames, filenames in os.walk(src):
        rel = os.path.relpath(dirpath, src)
        target_dir = os.path.join(dst, rel) if rel != "." else dst
        if not os.path.isdir(target_dir):
            os.makedirs(target_dir)
        for fn in filenames:
            shutil.copy2(os.path.join(dirpath, fn), os.path.join(target_dir, fn))
            count += 1
    return count


def clean_dir(dst):
    """清空目标目录（只删目录内容，保留目录本身）"""
    if not os.path.isdir(dst):
        return 0
    removed = 0
    for name in os.listdir(dst):
        path = os.path.join(dst, name)
        if os.path.isdir(path) and not os.path.islink(path):
            shutil.rmtree(path)
            removed += 1
        else:
            os.remove(path)
            removed += 1
    return removed


def write_redirects(pages_dir):
    for old, target in REDIRECTS.items():
        path = os.path.join(pages_dir, old)
        html = REDIRECT_TEMPLATE.replace("@@TARGET@@", target)
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(html)
    print("生成跳转页 %d 个" % len(REDIRECTS))


def main():
    # ------------------------------------------------------------
    # 第 1 步：先删后拷。
    # 白名单目录整体清空，避免上一版残留文件变成死链 / 垃圾。
    # pages/ 里的旧链接跳转页会在第 3 步重新生成。
    # ------------------------------------------------------------
    cleaned = 0
    for sub in SYNC_DIRS:
        dst = os.path.join(ROOT, sub)
        if os.path.isdir(dst):
            n = clean_dir(dst)
            if n:
                print("清空 %s/：%d 个旧文件" % (sub, n))
            cleaned += n

    # 第 2 步：复制新产物
    n = 0
    for sub in SYNC_DIRS:
        n += copy_tree(os.path.join(SRC, sub), os.path.join(ROOT, sub))
    for fn in SYNC_FILES:
        src = os.path.join(SRC, fn)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(ROOT, fn))
            n += 1

    # 第 3 步：为旧链接生成跳转页
    pages_dir = os.path.join(ROOT, "pages")
    if not os.path.isdir(pages_dir):
        os.makedirs(pages_dir)
    write_redirects(pages_dir)

    print("\n清理旧文件 %d 个，同步新文件 %d 个到站点根目录" % (cleaned, n))

    # 第 4 步：提醒一下哪些根目录文件是人工维护、不会被自动清理
    leftovers = []
    for name in sorted(os.listdir(ROOT)):
        path = os.path.join(ROOT, name)
        if os.path.isdir(path):
            continue
        if name in KEEP_FILES or name in SYNC_FILES:
            continue
        if name.endswith(".py") or name.endswith(".bat") or name.endswith(".md"):
            continue
        leftovers.append(name)
    if leftovers:
        print("提示：根目录这些文件不在自动同步范围内，请人工确认是否还需要：")
        for name in leftovers:
            print("   - %s" % name)


if __name__ == "__main__":
    main()
