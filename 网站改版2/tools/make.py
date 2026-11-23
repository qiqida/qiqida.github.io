# -*- coding: utf-8 -*-
"""
make.py —— 「网站改版2」统一构建入口

按正确顺序执行：
  1. build.py   —— md → 静态页面（子板块独立页 + 专区总览页）
  2. assets.py  —— 附件迁移 + 生成 data/ 里的自动配置文件
  3. home.py    —— 生成首页 index.html
  4. preview.py —— 生成独立预览站点 _preview/
  5. check.py   —— 页面质量报告

用法：
    python 网站改版2/tools/make.py
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))

STEPS = [
    ("build.py", "生成专区页面"),
    ("searchpage.py", "生成搜索结果页"),
    ("assets.py", "迁移附件并生成数据文件"),
    ("notices.py", "生成通知详情页"),
    ("home.py", "生成首页"),
    ("seo.py", "生成 sitemap / robots / 404"),
    ("fillcheck.py", "生成待填写清单"),
    ("preview.py", "生成预览站点"),
    ("check.py", "页面质量报告"),
]


def main():
    # 一次构建共用一个资源版本号。
    # 每个构建脚本是独立进程，通过环境变量把版本号传下去，
    # 这样首页和子页面引用的资源版本是一致的。
    env = dict(os.environ)
    env["SITE_VER"] = str(int(time.time()))

    for script, desc in STEPS:
        print("\n=== %s（%s） ===" % (script, desc))
        result = subprocess.run(
            [sys.executable, os.path.join(HERE, script)],
            cwd=HERE,
            env=env,
        )
        if result.returncode != 0:
            print("\n构建中断：%s 执行失败" % script)
            sys.exit(result.returncode)

    print("\n全部完成。预览入口：网站改版2/_preview/index.html")


if __name__ == "__main__":
    main()
