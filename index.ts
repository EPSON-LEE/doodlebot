import * as readline from "readline";
import { Colors } from "./src/constants/colors.js";
import { logger } from "./src/utils/logger.js";
import { memoryManager } from "./src/utils/memory.js";
import { agent, setupAgentSubscriptions } from "./src/agent.js";
import { ARK_CONFIG } from "./src/config.js";
import { taskManager, type BackgroundTask } from "./src/core/taskManager.js";

async function runCli() {
  if (!ARK_CONFIG.apiKey) {
    logger.error("未发现 API Key，请检查 .env 文件。");
    process.exit(1);
  }

  // 初始化设置
  setupAgentSubscriptions();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\n${Colors.yellow}${Colors.bright}你> ${Colors.reset}`
  });

  // 允许捕获按键 (用于 ESC 取消)
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  let isAgentRunning = false;

  // 监听按键
  process.stdin.on("keypress", (str, key) => {
    // 处理 Ctrl+C 退出
    if (key.ctrl && key.name === "c") {
      process.exit();
    }
    
    // 处理 ESC 取消
    if (key.name === "escape" && isAgentRunning) {
      logger.info("\n[操作取消]: 正在中断当前任务...");
      agent.abort();
    }
  });

  // ===== 后台任务事件监听 =====
  taskManager.on("task:done", (task: BackgroundTask) => {
    console.log(`\n  ${Colors.green}${Colors.bright}[后台任务完成]${Colors.reset} ${task.description} (${task.id})`);
    if (task.stdout) {
      const preview = task.stdout.length > 200 ? "..." + task.stdout.slice(-200) : task.stdout;
      console.log(`  ${Colors.gray}输出: ${preview.trim()}${Colors.reset}`);
    }
    if (!isAgentRunning) {
      rl.prompt();
    }
  });

  taskManager.on("task:error", (task: BackgroundTask) => {
    console.log(`\n  ${Colors.red}${Colors.bright}[后台任务失败]${Colors.reset} ${task.description} (${task.id})`);
    if (task.stderr) {
      const preview = task.stderr.length > 200 ? "..." + task.stderr.slice(-200) : task.stderr;
      console.log(`  ${Colors.gray}错误: ${preview.trim()}${Colors.reset}`);
    }
    if (!isAgentRunning) {
      rl.prompt();
    }
  });

  // 1. 加载历史记忆
  const history = memoryManager.load();

  // 启动界面
  const line = `${Colors.gray}${"─".repeat(48)}${Colors.reset}`;
  console.log();
  console.log(line);
  console.log(`  ${Colors.cyan}${Colors.bright}  DoodleBot  ${Colors.reset}${Colors.gray} - General Agent AI${Colors.reset}`);
  console.log(line);
  console.log(`  ${Colors.gray}Model   ${Colors.reset}${Colors.white}${ARK_CONFIG.model}${Colors.reset}`);

  if (history.length > 0) {
    agent.replaceMessages(history);
    console.log(`  ${Colors.gray}Memory  ${Colors.reset}${Colors.green}${history.length} messages restored${Colors.reset}`);
  } else {
    console.log(`  ${Colors.gray}Memory  ${Colors.reset}${Colors.dim}empty${Colors.reset}`);
  }

  console.log(`  ${Colors.gray}Hotkey  ${Colors.reset}${Colors.yellow}ESC${Colors.reset} cancel  ${Colors.dim}|${Colors.reset}  ${Colors.yellow}clear${Colors.reset} reset  ${Colors.dim}|${Colors.reset}  ${Colors.yellow}exit${Colors.reset} quit`);
  console.log(`  ${Colors.gray}Async   ${Colors.reset}${Colors.green}enabled${Colors.reset} ${Colors.dim}— 后台任务执行期间可继续对话${Colors.reset}`);
  console.log(line);

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    
    if (input.toLowerCase() === "clear") {
      memoryManager.clear();
      agent.replaceMessages([]);
      console.log(`  ${Colors.gray}Memory cleared.${Colors.reset}`);
      rl.prompt();
      return;
    }

    if (["exit", "quit", "退出"].includes(input.toLowerCase())) {
      console.log(`\n  ${Colors.gray}Goodbye.${Colors.reset}\n`);
      process.exit(0);
    }

    if (input) {
      if (isAgentRunning) {
        // ===== 核心改动：Agent 运行中，通过 steer 注入消息 =====
        agent.steer({
          role: "user",
          content: input,
          timestamp: Date.now(),
        } as any);
        console.log(`  ${Colors.gray}[已排队] 消息将在当前步骤完成后处理${Colors.reset}`);
      } else {
        // Agent 空闲，正常启动新的 prompt
        isAgentRunning = true;
        try {
          await agent.prompt(input);
        } catch (err: any) {
          if (err.message.includes("abort") || err.name === "AbortError") {
            logger.info("[任务已停止]");
          } else {
            logger.error(`系统发生异常: ${err.message}`);
          }
        } finally {
          isAgentRunning = false;
          rl.prompt();
        }
      }
    } else {
      rl.prompt();
    }
  });
}

runCli().catch((err) => logger.error(err.message));

