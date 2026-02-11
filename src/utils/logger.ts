import { Colors } from "../constants/colors.js";

export const logger = {
  info: (msg: string) => console.log(`${Colors.cyan}${msg}${Colors.reset}`),
  tool: (name: string, args: any) => console.log(`\n${Colors.magenta}🔧 [执行工具: ${name}]${Colors.reset} 参数: ${JSON.stringify(args)}`),
  result: (name: string, res: any) => console.log(`${Colors.green}✅ [工具结果: ${name}]${Colors.reset}`),
  error: (msg: string) => console.error(`${Colors.red}❌ ${msg}${Colors.reset}`),
  agent: (msg: string) => process.stdout.write(`${Colors.blue}${msg}${Colors.reset}`),
};
