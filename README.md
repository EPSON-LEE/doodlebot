# Doodlebot - Generic Agent AI

[English](#english) | [中文](#中文)

---

## 中文

Doodlebot 是一个基于 pi-agent-core 构建的高级智能助理，具备本机操作能力、联网调研能力以及标准化的技能扩展系统。

### 核心功能
- **本机操作**: 执行终端命令、管理本地文件系统。
- **联网能力**: 集成 Playwright 浏览器引擎，支持网页文本抓取与实时截图。
- **技能系统**: 遵循 Pi-Mono 标准，支持通过 Markdown 定义复杂的工作流（如 web-research, news-summary）。
- **多端接入**: 同时支持本地交互式命令行 (CLI) 和远程 Telegram Bot 接入。
- **持久化记忆**: 对话历史自动保存，确保上下文连贯。

### 快速开始
1. **安装依赖**:
   ```bash
   npm install
   npx playwright install chromium
   ```
2. **配置环境**:
   复制 .env.example 为 .env 并填写你的 ARK_API_KEY 和 TELEGRAM_BOT_TOKEN。
3. **运行**:
   - 命令行模式: npm run dev
   - Telegram 模式: npm run telegram

---

## English

Doodlebot is an advanced AI assistant built on pi-agent-core, featuring local machine operations, web research capabilities, and a standardized skill expansion system.

### Key Features
- **Local Ops**: Execute terminal commands and manage the local file system.
- **Web Powered**: Integrated Playwright engine for web scraping and real-time screenshots.
- **Skill System**: Follows the Pi-Mono standard, supporting complex workflows defined via Markdown (e.g., web-research, news-summary).
- **Multi-platform**: Supports both interactive CLI and remote Telegram Bot.
- **Persistence**: Automatic conversation history saving for seamless context.

### Quick Start
1. **Install**:
   ```bash
   npm install
   npx playwright install chromium
   ```
2. **Configure**:
   Copy .env.example to .env and fill in your ARK_API_KEY and TELEGRAM_BOT_TOKEN.
3. **Run**:
   - CLI Mode: npm run dev
   - Telegram Mode: npm run telegram
