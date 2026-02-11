---
name: news-summary
description: 每日技术头条汇总。自动抓取主流技术社区（如 Hacker News, GitHub Trending）的热门内容并总结。
---

# 每日技术头条汇总技能

本技能旨在帮助你快速获取互联网上最新的技术动态，并以精简的方式呈现。

## 操作流程

1. **选择来源**:
   根据用户偏好或默认选择以下来源之一：
   - **Hacker News**: `https://news.ycombinator.com` (全球黑客动态)
   - **GitHub Trending**: `https://github.com/trending` (热门开源项目)

2. **执行抓取**:
   使用 `web_scraper` 访问选定的 URL。建议设置 `waitMillis: 3000` 以确保内容加载。

3. **智能总结**:
   - 提取前 5-8 条新闻标题及链接。
   - 对每条新闻进行简要描述（如果是外文，请翻译成中文）。
   - 识别今天的“重磅推荐”或“技术突破”。

4. **格式化输出**:
   - 使用 Markdown 列表或表格，以便用户在终端或 Telegram 中阅读。
   - **重要限制**：总结出的文本中**严禁使用任何 Emoji 表情符号**，保持极其简洁专业的纯文本风格。

## 示例指令

- "帮我汇总一下今天的 Hacker News"
- "看看 GitHub 今天的热门趋势"
- "总结一下这两天的科技新闻"
