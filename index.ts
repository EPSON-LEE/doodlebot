import { Agent } from "@mariozechner/pi-agent-core";
import { type AgentTool, type AgentEvent } from "@mariozechner/pi-agent-core";
import { Type, getModel } from "@mariozechner/pi-ai";
import * as dotenv from "dotenv";

dotenv.config();

import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

// 1. 定义多功能工具集
const tools: AgentTool<any>[] = [
  // --- 面积计算器 (保留作为参考) ---
  {
    name: "calculate_area",
    label: "面积计算器",
    description: "计算圆或矩形的面积",
    parameters: Type.Union([
      Type.Object({ shape: Type.Literal("circle"), radius: Type.Number() }),
      Type.Object({ shape: Type.Literal("rectangle"), width: Type.Number(), height: Type.Number() })
    ]),
    execute: async (toolCallId, params) => {
      const area = params.shape === "circle" ? Math.PI * params.radius ** 2 : params.width * params.height;
      const result = area.toFixed(2);
      return { 
        content: [{ type: "text", text: `面积计算结果: ${result}` }],
        details: { area: result }
      };
    }
  },

  // --- Shell 命令执行器 ---
  {
    name: "execute_command",
    label: "终端命令",
    description: "在本地终端执行 shell 命令。只能在当前工作目录下执行命令，禁止破坏性操作。",
    parameters: Type.Object({
      command: Type.String({ description: "要执行的 shell 命令，例如 'ls', 'pwd', 'node -v'" })
    }),
    execute: async (toolCallId, params) => {
      console.log(`\n[执行系统命令]: ${params.command}`);
      try {
        const { stdout, stderr } = await execAsync(params.command, { timeout: 10000 });
        const output = stdout || stderr || "命令已执行，无输出内容。";
        return { 
          content: [{ type: "text", text: output.slice(0, 2000) }],
          details: { success: true, output }
        };
      } catch (error: any) {
        return { 
          content: [{ type: "text", text: `执行失败: ${error.message}` }],
          details: { success: false, error: error.message },
          isError: true 
        };
      }
    }
  },

  // --- 文件管理器 ---
  {
    name: "manage_files",
    label: "文件管理器",
    description: "读取文件内容或列出目录文件",
    parameters: Type.Union([
      Type.Object({ action: Type.Literal("read"), path: Type.String({ description: "相对路径" }) }),
      Type.Object({ action: Type.Literal("list"), path: Type.String({ description: "目录路径，默认为 '.'" }) })
    ]),
    execute: async (toolCallId, params) => {
      const targetPath = path.resolve(process.cwd(), params.path || ".");
      try {
        if (params.action === "list") {
          const files = await fs.readdir(targetPath);
          return { 
            content: [{ type: "text", text: `目录清单:\n${files.join("\n")}` }],
            details: { action: "list", files }
          };
        } else {
          const content = await fs.readFile(targetPath, "utf-8");
          return { 
            content: [{ type: "text", text: `文件内容 (${params.path}):\n\n${content.slice(0, 2000)}` }],
            details: { action: "read", path: params.path }
          };
        }
      } catch (error: any) {
        return { 
          content: [{ type: "text", text: `操作失败: ${error.message}` }],
          details: { success: false, error: error.message },
          isError: true 
        };
      }
    }
  }
];

// 2. 模型设置
// 由于火山方舟是自定义模型，我们手动定义 Model 对象
const model: any = {
  id: process.env.ARK_MODEL_NAME || "doubao-seed-code",
  name: "Volcengine Ark",
  api: "openai-completions", // 使用标准 Chat Completions API
  provider: "openai",
  baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/coding/v3",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 4096,
};

// 3. 初始化 Agent
const agent = new Agent({
  initialState: {
    systemPrompt: "你是一个拥有本机操作权限的通用 Agent AI。你可以计算面积、执行终端命令（仅限查看和非破坏性命令）以及查阅本地文件。请根据用户的需求灵活使用工具。你可以先通过 ls 列出文件，再通过读取文件内容来回答问题。如果你需要运行多条命令，请逐步执行。",
    model: model,
    tools: tools
  },
  // 提供 API Key 处理逻辑
  getApiKey: (provider) => {
    if (provider === "openai" || provider === model.provider) {
      return process.env.ARK_API_KEY;
    }
    return undefined;
  }
});

// 4. 订阅事件以查看执行流程
agent.subscribe((event: AgentEvent) => {
  switch (event.type) {
    case "message_update":
        // 处理消息更新（流式输出）
        break;
    case "tool_execution_start":
        console.log(`\n[执行工具] ${event.toolName}，参数为:`, event.args);
        break;
    case "tool_execution_end":
        console.log(`[工具结果] ${event.toolName}:`, event.result);
        break;
        case "turn_end":
            console.log("\n--- Agent 回复 ---");
            const lastMessage = event.message;
            if (Array.isArray(lastMessage.content)) {
                const textContent = lastMessage.content.find(c => c.type === "text");
                if (textContent && textContent.type === "text") {
                    console.log(textContent.text);
                }
            } else if (typeof lastMessage.content === "string") {
                console.log(lastMessage.content);
            }
            break;
  }
});

// 5. 运行 Prompt
async function main() {
    if (!process.env.ARK_API_KEY && !process.env.OPENAI_API_KEY) {
        console.warn("警告：.env 文件中未设置 API Key。LLM 调用可能会失败。");
    }
    
    console.log("--- Agent Prompt: 统计当前目录下的文件及其大小 ---");
    try {
        await agent.prompt("列出当前目录下的所有文件，并告诉我 package.json 的内容。");
    } catch (error) {
        console.error("\nAgent 执行过程中出错:", error);
    }
}

main().catch(console.error);
