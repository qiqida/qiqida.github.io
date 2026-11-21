# -*- coding: utf-8 -*-
"""
pinyin_util.py —— 生成搜索用的拼音索引

作用：让用户在搜索框里用「拼音首字母」也能搜到内容。
例：输入 qj 能搜到「请假」，jx 能搜到「奖学金」。

实现：
  - 构建期（Python）用 pypinyin 把标题/关键词转成
    「全拼」与「首字母」两种形式，写进 data/knowledge-base.json；
  - 运行时（浏览器）只需要对「用户输入的关键词」做同样的转换。
    为避免前端再引一个拼音库，这里在构建期额外生成一份
    data/pinyin-table.json（汉字 → 首字母），前端直接查表。

依赖：
  pypinyin 是**可选**的。没装时跳过拼音功能，站点照常工作，
  只是搜索不支持拼音首字母。CI 里如果需要，装一下即可：
      pip install pypinyin

运行：
    python 网站改版2/tools/pinyin_util.py
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
DATA = os.path.join(ROOT, "data")

# pypinyin 是可选依赖
try:
    from pypinyin import Style, lazy_pinyin
    HAS_PINYIN = True
except ImportError:  # pragma: no cover
    HAS_PINYIN = False


def to_full(text):
    """中文转全拼，如「请假」-> ['qing', 'jia']"""
    if not HAS_PINYIN or not text:
        return []
    return lazy_pinyin(text, style=Style.NORMAL, errors="ignore")


def to_initials(text):
    """中文转首字母，如「请假」-> ['q', 'j']"""
    if not HAS_PINYIN or not text:
        return []
    return lazy_pinyin(text, style=Style.FIRST_LETTER, errors="ignore")


def build_pinyin_index(texts):
    """
    生成 {汉字: 首字母} 映射表，只包含站点实际用到的汉字。

    前端搜「qj」时，把输入里每个汉字查表转成首字母；
    查不到的（生僻字、非汉字）原样保留。
    """
    table = {}
    for t in texts:
        if not t:
            continue
        for ch, ini in zip(t, to_initials(t)):
            if ch not in table and ini:
                table[ch] = ini
    return table


def write_pinyin_table(path=None):
    """生成 data/pinyin-table.json"""
    if not HAS_PINYIN:
        print("  [跳过] 没装 pypinyin，不生成拼音表（搜索将不支持拼音首字母）")
        return None

    # 收集所有用到的汉字：从内容 md + 数据 json 里抓
    chars = set()
    content_dir = os.path.join(ROOT, "内容")
    for dirpath, dirnames, filenames in os.walk(content_dir):
        for fn in filenames:
            if not fn.lower().endswith(".md"):
                continue
            with io.open(os.path.join(dirpath, fn), "r", encoding="utf-8") as f:
                for ch in f.read():
                    if "\u4e00" <= ch <= "\u9fff":
                        chars.add(ch)

    table = {ch: to_initials(ch)[0] for ch in sorted(chars) if to_initials(ch)}

    path = path or os.path.join(DATA, "pinyin-table.json")
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(json.dumps(table, ensure_ascii=False, separators=(",", ":")))
    print("wrote: %s（%d 个汉字）" % (os.path.relpath(path, ROOT), len(table)))
    return table


def main():
    if not os.path.isdir(DATA):
        os.makedirs(DATA)
    write_pinyin_table()


if __name__ == "__main__":
    main()
