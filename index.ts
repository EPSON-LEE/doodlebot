import * as readline from "readline";
import { Colors } from "./src/constants/colors.js";
import { logger } from "./src/utils/logger.js";
import { memoryManager } from "./src/utils/memory.js";
import { agent, setupAgentSubscriptions } from "./src/agent.js";
import { ARK_CONFIG } from "./src/config.js";

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

  // 1. 加载历史记忆
  const history = memoryManager.load();
  if (history.length > 0) {
    agent.replaceMessages(history);
    logger.info(`已从记忆中恢复 ${history.length} 条消息。`);
  }

  logger.info("=== 通用 Agent AI  ===");
  logger.info("输入指令（输入 'clear' 清空记忆，'exit' 退出）");

    rl.prompt();

    rl.on("line", async (line) => {
    const input = line.trim();
    
    if (input.toLowerCase() === "clear") {
      memoryManager.clear();
      agent.replaceMessages([]);
      rl.prompt();
      return;
    }

    if (["exit", "quit", "退出"].includes(input.toLowerCase())) {
      console.log("挥挥手，不带走一片云彩～");
      process.exit(0);
    }

    if (input) {
      // 临时挂起提示符，避免流式输出乱序
      rl.pause(); 
      try {
        await agent.prompt(input);
      } catch (err: any) {
        logger.error(`系统发生异常: ${err.message}`);
      }
      rl.resume();
    }
    rl.prompt();
  });
}

runCli().catch((err) => logger.error(err.message));
