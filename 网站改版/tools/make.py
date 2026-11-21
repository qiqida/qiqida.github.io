# -*- coding: utf-8 -*-
"""
make.py —— 「网站改版」统一构建入口

按正确顺序执行：
  1. build.py   —— md → 静态页面（pages/）
  2. assets.py  —— 附件迁移 + 生成 data/ 里的自动配置文件
  3. home.py    —— 生成首页 index.html
  4. preview.py —— 生成独立预览站点 _preview/

用法：
    python 网站改版/tools/make.py
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

STEPS = [
    ("build.py", "生成专区页面"),
    ("assets.py", "迁移附件并生成数据文件"),
    ("home.py", "生成首页"),
    ("preview.py", "生成预览站点"),
]


def main():
    for script, desc in STEPS:
        print("\n=== %s（%s） ===" % (script, desc))
        result = subprocess.run(
            [sys.executable, os.path.join(HERE, script)],
            cwd=HERE,
        )
        if result.returncode != 0:
            print("\n构建中断：%s 执行失败" % script)
            sys.exit(result.returncode)

    print("\n全部完成。预览入口：网站改版/_preview/index.html")


if __name__ == "__main__":
    main()
