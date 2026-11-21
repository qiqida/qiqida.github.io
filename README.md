# 工学部研究生事务服务中心

研究生事务自助查询网站 —— 把「请假要交什么、奖学金怎么评、一卡通怎么补办」
这类重复的事务流程，按八个专区整理清楚，每一步写明「先做什么、再做什么、交什么材料」。

**线上地址：https://qiqida.github.io/**

---

## 快速开始

| 我想… | 去哪儿 |
|---|---|
| 知道某件事的流程 | 首页搜关键词 → 进对应专区 |
| 直接下载表格 | 文件专区 |
| 卡住了、不知道找谁 | 问题专区 |
| 第一次用这个网站 | 首页「重要通知」置顶那条 |

## 八个专区

| 专区 | 管什么 |
|---|---|
| 新生专区 | 从报到到上课 |
| 在校学习专区 | 请假、选课与成绩 |
| 奖助专区 | 奖学金与助学金 |
| 党团专区 | 党组织与团组织 |
| 生活与证件专区 | 住宿、校园卡与证明 |
| 实习就业与毕业专区 | 实习、就业到离校 |
| 文件专区 | 表格与模板下载 |
| 问题专区 | 卡住了看这里 |

---

## 给维护者

> **日常维护只改 `网站改版2/内容/` 里的 Markdown 文件，其余都是构建产物。**

改完 push，GitHub Actions 自动构建 → 查链接 → 同步 → 部署，1–3 分钟上线。

**完整维护说明看 → [`docs/maintenance-guide.md`](docs/maintenance-guide.md)**

### 目录分工

| 路径 | 是什么 |
|---|---|
| `网站改版2/内容/` | **内容源**（Markdown）—— 改这里 |
| `网站改版2/tools/` | 构建脚本 |
| `网站改版2/assets/` | CSS / JS |
| `index.html` `pages/` `data/` `files/` | 构建产物 —— 不要手改 |

### 本地预览

```bash
# Windows
双击 更新网站.bat

# 或者
python 网站改版2/tools/make.py
```

然后打开 `网站改版2/_preview/index.html`。

### 常用命令

```bash
python 网站改版2/tools/make.py          # 全量构建
python 网站改版2/tools/check.py         # 页面质量报告
python 网站改版2/tools/linkcheck.py      # 链接检查
python 网站改版2/tools/placeholders.py  # 列出还没填的【　】
```

### 技术栈

- 纯静态站点，无运行时依赖
- 内容用 Markdown 写，构建脚本（Python）生成 HTML
- GitHub Actions 自动构建部署到 GitHub Pages
- 站内搜索：前端模糊匹配 + 拼音首字母索引

### 部署

- GitHub Pages，`main` 分支根目录
- `.nojekyll` + `_config.yml` 跳过 Jekyll（本站不需要它）
- CI 工作流：`.github/workflows/build-site.yml`
