import { Colors } from "../constants/colors.js";
import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LLM_LOG_PATH = path.join(LOG_DIR, "llm.log");

export const logger = {
  info: (msg: string) => console.log(`${Colors.cyan}${msg}${Colors.reset}`),
  tool: (name: string, args: any) => console.log(`\n${Colors.magenta}[执行工具: ${name}]${Colors.reset} 参数: ${JSON.stringify(args)}`),
  result: (name: string, res: any) => console.log(`${Colors.green}[工具结果: ${name}]${Colors.reset}`),
  error: (msg: string) => console.error(`${Colors.red}[错误] ${msg}${Colors.reset}`),
  agent: (msg: string) => process.stdout.write(`${Colors.blue}${msg}${Colors.reset}`),
  llmCall: (messages: any[]) => {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

    const timestamp = new Date().toLocaleString();
    let logContent = `\n${'='.repeat(20)} [LLM 调用上下文探测] ${timestamp} ${'='.repeat(20)}\n`;
    
    messages.forEach((m, i) => {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      logContent += `[${i}] ${m.role.toUpperCase()}: ${content}\n`;
    });
    
    logContent += `${'='.repeat(70)}\n`;
    
    fs.appendFileSync(LLM_LOG_PATH, logContent, "utf-8");
  },
};
