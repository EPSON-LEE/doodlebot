import { Agent } from "@mariozechner/pi-agent-core";
import { type AgentTool, type AgentEvent } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as readline from "readline";

dotenv.config();

const execAsync = promisify(exec);

/**
 * 终端颜色辅助工具
 */
const Colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

/**
 * 格式化打印工具
 */
const logger = {
  info: (msg: string) => console.log(`${Colors.cyan}${msg}${Colors.reset}`),
  tool: (name: string, args: any) => console.log(`\n${Colors.magenta}🔧 [执行工具: ${name}]${Colors.reset} 参数: ${JSON.stringify(args)}`),
  result: (name: string, res: any) => console.log(`${Colors.green}✅ [工具结果: ${name}]${Colors.reset}`),
  error: (msg: string) => console.error(`${Colors.red}❌ ${msg}${Colors.reset}`),
  agent: (msg: string) => process.stdout.write(`${Colors.blue}${msg}${Colors.reset}`),
};

// 1. 定义 Agent 的工具集 (能力集)
const agentTools: AgentTool<any>[] = [
  {
    name: "calculate_area",
    label: "面积计算器",
    description: "计算圆或矩形的面积",
    parameters: Type.Union([
      Type.Object({ shape: Type.Literal("circle"), radius: Type.Number() }),
      Type.Object({ shape: Type.Literal("rectangle"), width: Type.Number(), height: Type.Number() })
    ]),
    execute: async (id, params) => {
      const area = params.shape === "circle" ? Math.PI * params.radius ** 2 : params.width * params.height;
      const res = area.toFixed(2);
      return { 
        content: [{ type: "text", text: `计算结果为 ${res}` }],
        details: { area: res }
      };
    }
  },
  {
    name: "execute_command",
    label: "终端命令",
    description: "执行 shell 命令。例如 'ls', 'pwd'。禁止破坏性操作。",
    parameters: Type.Object({
      command: Type.String({ description: "shell 命令" })
    }),
    execute: async (id, params) => {
      try {
        const { stdout, stderr } = await execAsync(params.command, { timeout: 10000 });
        const output = stdout || stderr || "(无输出)";
        return { 
          content: [{ type: "text", text: output.slice(0, 2000) }],
          details: { output }
        };
      } catch (e: any) {
        return { 
          content: [{ type: "text", text: `报错: ${e.message}` }],
          details: { error: e.message },
          isError: true 
        };
      }
    }
  },
  {
    name: "manage_files",
    label: "文件管理器",
    description: "列出目录或读取文件内容",
    parameters: Type.Union([
      Type.Object({ action: Type.Literal("read"), path: Type.String() }),
      Type.Object({ action: Type.Literal("list"), path: Type.String({ default: "." }) })
    ]),
    execute: async (id, params) => {
      const target = path.resolve(process.cwd(), params.path || ".");
      try {
        if (params.action === "list") {
          const files = await fs.readdir(target);
          return { content: [{ type: "text", text: files.join("\n") }], details: { files } };
        } else {
          const content = await fs.readFile(target, "utf-8");
          return { content: [{ type: "text", text: content.slice(0, 3000) }], details: { path: params.path } };
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `错误: ${e.message}` }], details: { error: e.message }, isError: true };
      }
    }
  }
];

// 2. 环境验证
const ARK_CONFIG = {
  apiKey: process.env.ARK_API_KEY,
  baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/coding/v3",
  model: process.env.ARK_MODEL_NAME || "doubao-seed-code",
};

// 3. 初始化 Agent
const agent = new Agent({
  initialState: {
    systemPrompt: "你是一个具备本机操作能力的智能助理。你可以通过终端命令和文件管理工具来了解环境并执行任务。始终保持回复简洁、专业。",
    model: {
      id: ARK_CONFIG.model,
      name: "Volcengine Ark",
      api: "openai-completions",
      provider: "openai",
      baseUrl: ARK_CONFIG.baseUrl,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4096,
    } as any,
    tools: agentTools
  },
  getApiKey: (p) => (p === "openai" ? ARK_CONFIG.apiKey : undefined)
});

let hasStreamed = false;

// 4. 事件订阅 (增加调试日志)
agent.subscribe((event: AgentEvent) => {
  // 调试日志：查看所有到达的事件
  // console.log(`[DEBUG] 收到事件: ${event.type}`);

  switch (event.type) {
    case "turn_start":
      hasStreamed = false;
      break;

    case "message_start":
      if (event.message.role === "assistant") {
        process.stdout.write(`${Colors.dim}AI 正在思考...${Colors.reset}\r`);
      }
      break;

    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        if (event.assistantMessageEvent.delta) {
          if (!hasStreamed) {
            // 第一次收到 delta 时，清除“正在思考”
            process.stdout.write(" ".repeat(20) + "\r");
          }
          hasStreamed = true;
          logger.agent(event.assistantMessageEvent.delta);
        }
      }
      break;
      
    case "tool_execution_start":
      hasStreamed = true; // 工具执行也被视为有了进展
      logger.tool(event.toolName, event.args);
      break;
      
    case "tool_execution_end":
      logger.result(event.toolName, event.result);
      break;
      
    case "turn_end":
      // 兜底显示
      if (event.message.role === "assistant" && !hasStreamed) {
        const fullContent = event.message.content;
        let text = "";
        if (Array.isArray(fullContent)) {
          const textNode = fullContent.find(c => (c as any).type === "text") as any;
          text = textNode?.text || "";
        } else if (typeof fullContent === "string") {
          text = fullContent;
        }
        
        if (text) {
          logger.agent(text);
        } else {
          // 如果依然没内容，打印一个提示
          logger.error("Agent 运行完成，但未返回任何内容或工具调用。");
        }
      }
      process.stdout.write("\n"); 
      break;
  }
});

// 5. 交互式界面
async function runCli() {
  if (!ARK_CONFIG.apiKey) {
    logger.error("未发现 API Key，请检查 .env 文件。");
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\n${Colors.yellow}${Colors.bright}你 > ${Colors.reset}`
  });

  logger.info("=== 通用 Agent AI (优化版) 已就绪 ===");
  logger.info("输入指令（例如：'清空控制台并告诉我当前目录有什么'）");

  rl.prompt();

    rl.on("line", async (line) => {
    const input = line.trim();
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
