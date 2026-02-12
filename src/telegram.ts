import { Telegraf } from "telegraf";
import { agent } from "./agent.js";
import { type AgentEvent } from "@mariozechner/pi-agent-core";
import { ARK_CONFIG } from "./config.js";
import { memoryManager } from "./utils/memory.js";
import { PROMPTS } from "./constants/prompts.js";
import { taskManager, type BackgroundTask } from "./core/taskManager.js";

if (!ARK_CONFIG.telegramToken) {
  console.error("未发现 TELEGRAM_BOT_TOKEN，请在 .env 文件中设置。");
  process.exit(1);
}

const bot = new Telegraf(ARK_CONFIG.telegramToken, {
  handlerTimeout: 300_000 // 增加处理超时到 5 分钟，防止复杂网页抓取超时
});

// 全局错误捕获，防止 Promise 未处理异常导致进程崩溃
bot.catch((err, ctx) => {
  console.error(`Telegram 运行错误 (${ctx.update.update_id}):`, err);
  ctx.reply("抱歉，处理您的请求时发生了严重的系统错误或超时。").catch(() => {});
});

/**
 * 设置专门针对 Telegram 的事件订阅
 * @param chatId 当前对话的 ID
 */
function setupTelegramSubscriptions(chatId: number) {
  return agent.subscribe((event: AgentEvent) => {
    switch (event.type) {
      case "message_start":
        if (event.message.role === "assistant") {
           // Telegram 不支持流式空字符占位，显示一个"思考中"提示
           bot.telegram.sendChatAction(chatId, "typing").catch(() => {});
        }
        break;

      case "tool_execution_start":
        bot.telegram.sendMessage(chatId, `[执行工具]: ${event.toolName}...`).catch(() => {});
        break;

      case "tool_execution_end":
        // 如果工具结果包含截图路径，发送图片到 Telegram
        if (event.result.details && (event.result.details as any).screenshotPath) {
          const photoPath = (event.result.details as any).screenshotPath;
          bot.telegram.sendPhoto(chatId, { source: photoPath }, { caption: `网页截图: ${event.toolName}` }).catch(err => {
            console.error("发送截图失败:", err);
          });
        }
        // 如果工具报错，给予反馈
        if (event.result.isError) {
          bot.telegram.sendMessage(chatId, `[工具报错]: ${event.toolName}`).catch(() => {});
        }
        break;

      case "turn_end":
        if (event.message.role === "assistant") {
          const content = event.message.content;
          let text = "";
          if (Array.isArray(content)) {
            const textNode = content.find(c => (c as any).type === "text") as any;
            text = textNode?.text || "";
          } else if (typeof content === "string") {
            text = content;
          }
          
          if (text) {
            bot.telegram.sendMessage(chatId, text, { parse_mode: "Markdown" }).catch(() => {
              // 如果 Markdown 解析失败（由于特殊字符），退回到纯文本
              bot.telegram.sendMessage(chatId, text);
            });
          }
        }
        // 同步持久化记忆
        memoryManager.save(agent.state.messages);
        break;
    }
  });
}

// 启动逻辑
async function main() {
  console.log("Telegram Bot 正在启动...");

  // 加载记忆
  const history = memoryManager.load();
  if (history.length > 0) {
    agent.replaceMessages(history);
    console.log(`[Memory] 已从记忆中恢复 ${history.length} 条消息。`);
  }

  // 跟踪 Agent 运行状态和活跃的 chatId
  let isAgentRunning = false;
  let activeChatId: number | null = null;

  // ===== 后台任务完成通知 =====
  taskManager.on("task:done", (task: BackgroundTask) => {
    if (activeChatId) {
      bot.telegram.sendMessage(
        activeChatId,
        `[后台任务完成] ${task.description}\nTaskID: ${task.id}\n退出码: ${task.exitCode}`
      ).catch(() => {});
    }
  });

  taskManager.on("task:error", (task: BackgroundTask) => {
    if (activeChatId) {
      const errPreview = task.stderr ? task.stderr.slice(-200) : "未知错误";
      bot.telegram.sendMessage(
        activeChatId,
        `[后台任务失败] ${task.description}\nTaskID: ${task.id}\n错误: ${errPreview}`
      ).catch(() => {});
    }
  });

  bot.on("text", async (ctx) => {
    const input = ctx.message.text.trim();
    activeChatId = ctx.chat.id;
    
    if (input.toLowerCase() === "/clear") {
      memoryManager.clear();
      agent.replaceMessages([]);
      return ctx.reply("持久化记忆已清空。");
    }

    if (input.toLowerCase() === "/start") {
      return ctx.reply(PROMPTS.TELEGRAM_GREETING);
    }

    if (input.toLowerCase() === "/tasks") {
      const tasks = taskManager.listTasks();
      if (tasks.length === 0) {
        return ctx.reply("当前没有后台任务。");
      }
      const summary = tasks.map(t => taskManager.formatTask(t)).join("\n\n");
      return ctx.reply(`后台任务列表:\n\n${summary}`);
    }

    // ===== 核心改动：Agent 运行中，通过 steer 注入消息 =====
    if (isAgentRunning) {
      agent.steer({
        role: "user",
        content: input,
        timestamp: Date.now(),
      } as any);
      ctx.reply("[已收到] 你的消息已排队，Agent 将在当前步骤完成后处理。").catch(() => {});
      return;
    }

    // 为当前对话设置订阅
    const unsubscribe = setupTelegramSubscriptions(ctx.chat.id);
    
    isAgentRunning = true;
    try {
      await agent.prompt(input);
    } catch (err: any) {
      ctx.reply(`系统异常: ${err.message}`);
    } finally {
      isAgentRunning = false;
      // 任务完成后取消订阅，防止内存泄漏和重复发送
      unsubscribe();
    }
  });

  bot.launch();
  console.log("Telegram Bot 已上线！可以在 Telegram 中与它对话了。");

  // 优雅退出
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch(err => console.error("启动失败:", err));

