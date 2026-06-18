# 研究生事务服务平台维护指引

这份文档给以后维护网站时使用。你不需要一次学完所有代码，先按“改哪里、检查什么、怎么保存版本”这条线操作即可。

## 一、每次修改前先保存当前版本

在 VS Code 终端进入项目目录：

```bash
cd E:\project\graduate-service-center
```

查看当前有没有未保存到 Git 的改动：

```bash
git status
```

如果准备开始一次新的修改，建议先确认当前版本是干净的。看到 `nothing to commit` 就表示当前版本已经保存好了。

## 二、修改后如何保存一个版本

每次完成一个小功能后，依次执行：

```bash
git status
git add .
git commit -m "说明这次改了什么"
```

示例：

```bash
git commit -m "feat: add clickable hot service cards"
```

常用提交说明：

- `feat:` 新功能
- `fix:` 修复问题
- `docs:` 修改说明文档
- `style:` 调整样式
- `chore:` 项目整理

## 三、搜索内容怎么维护

首页搜索框读取的是：

```text
data/knowledge-base.json
```

新增搜索项时，复制一段已有内容，然后改标题、分类、链接和关键词：

```json
{
  "title": "毕业登记表填写",
  "category": "毕业专区",
  "url": "pages/graduation.html",
  "keywords": ["毕业", "登记表", "学位", "填写"]
}
```

注意：

- JSON 文件不能写注释。
- 每一项之间要用英文逗号 `,` 分隔。
- 最后一项后面不要加逗号。
- `url` 要写真实存在的页面路径。

## 四、通知怎么维护

目前首页通知读取的是：

```text
data/notices.json
```

短通知可以直接写在 `notices.json` 里：

```json
{
  "id": "2026003",
  "title": "这里写通知标题",
  "date": "2026-10-01",
  "summary": "这里写首页显示的简短摘要",
  "content": "这里写通知正文，可以先用普通文字。"
}
```

当前建议：短通知直接写在 `notices.json` 里，最简单、最稳定。

长通知建议写成 Markdown 文件。先在 `notices` 文件夹里新建一个文件，例如：

```text
notices/2026003.md
```

然后在 `data/notices.json` 里新增索引：

```json
{
  "id": "2026003",
  "title": "这里写通知标题",
  "date": "2026-10-01",
  "summary": "这里写首页显示的简短摘要",
  "markdown": "notices/2026003.md"
}
```

Markdown 通知里可以写标题、列表、加粗和外部链接：

```markdown
# 通知标题

这里是正文。

## 材料清单

- 申请表
- 成绩单

请查看 [学校研究生院](https://yjsy.scnu.edu.cn/)。
```

注意：外部链接必须写完整网址，例如 `https://...`。

## 五、文件下载怎么维护

下载中心读取的是：

```text
data/downloads.json
```

文件建议放在：

```text
files/
```

新增下载项示例：

```json
{
  "title": "请假申请表",
  "category": "事务办理",
  "date": "2026-01-01",
  "file": "files/请假申请表.docx"
}
```

注意 `file` 的文件名必须和 `files` 文件夹里的真实文件名一致。

## 六、首页卡片怎么改跳转

首页主要卡片都在：

```text
index.html
```

看到这种结构：

```html
<a href="pages/leave.html" class="card">
```

其中 `href` 就是点击后跳转的位置。

## 七、上线前检查清单

每次准备发布前，建议检查：

- 首页能打开。
- 搜索框能搜到常用关键词。
- 首页卡片能点击跳转。
- 通知详情页能打开。
- 下载按钮能下载到真实文件。
- 手机端宽度下页面没有文字挤出或重叠。

## 八、遇到改坏了怎么办

先查看最近提交记录：

```bash
git log --oneline
```

如果只是想看哪里改了：

```bash
git diff
```

如果你不确定怎么恢复，不要急着执行 `reset`，把终端输出发给 Codex 一起判断。
