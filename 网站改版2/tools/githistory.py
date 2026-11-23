# -*- coding: utf-8 -*-
"""
githistory.py —— 查内容文件最后一次被提交修改的时间

为什么需要这个
--------------
页面底部要显示「最后更新：2026-11-20」，让学生知道这个流程是不是最新的。

日期从哪来？有两个来源，优先级如下：

  1. **md 的 front-matter 里写了 updated** —— 手动指定，最准确。
     适合「流程本身没变，只是换了份文件」这种需要固定日期的情况。

  2. **git 里这个文件最后一次被提交的日期** —— 自动推导，零维护成本。
     改完 md 提交一次，日期自动更新，不用手动写。

为什么不直接用文件修改时间（mtime）：
    git clone / checkout / CI 检出时会把所有文件的 mtime 重置成「检出时刻」，
    全部文件都变成今天。所以 mtime 不能用。

实现
----
用一次 `git log --name-only` 拿到全部文件的最后提交日期，
建一张「文件路径 → 日期」的表，比逐个文件调 git 快得多。
"""
import io
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))


def _run_git(args):
    """跑 git 命令，失败返回空串（不抛异常，构建不能因为 git 挂了就崩）"""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
        if result.returncode != 0:
            return ""
        return result.stdout
    except Exception:
        return ""


def build_file_dates():
    """
    拿到「仓库相对路径 → 最后提交日期」表。

    用 `git log --name-only --format=...` 一次拿全，
    遇到同一个文件的后续提交就跳过（第一次遇到的就是最新的）。

    注意：git 默认会把中文路径转义成 \\346\\253\\210 这种八进制，
    所以要加 -c core.quotePath=false 让它输出原始 UTF-8 路径。
    """
    output = _run_git([
        "-c",
        "core.quotePath=false",
        "log",
        "--name-only",
        "--date=short",
        "--format=__COMMIT__%ad",
    ])
    if not output:
        return {}

    dates = {}
    current = ""
    for line in output.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("__COMMIT__"):
            current = line[len("__COMMIT__"):].strip()
            continue
        # 路径行
        if current and line not in dates:
            dates[line] = current
    return dates


def get_updated_dates():
    """
    返回 {仓库相对路径（正斜杠）: "YYYY-MM-DD"}。

    注意返回的 key 是**仓库根的相对路径**，
    比如 "网站改版2/内容/03_在校学习专区/01_请假与考勤.md"，
    调用方要自己拼出这个路径。
    """
    return build_file_dates()


# 便于单独测试：python githistory.py
if __name__ == "__main__":
    dates = get_updated_dates()
    print("共 %d 个文件有提交记录" % len(dates))
    for k in sorted(dates)[:10]:
        print("  %s  %s" % (dates[k], k))
