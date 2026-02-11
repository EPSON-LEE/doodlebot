import { Agent } from "@mariozechner/pi-agent-core";
import { type AgentTool, type AgentEvent } from "@mariozechner/pi-agent-core";
import { Type, getModel } from "@mariozechner/pi-ai";
import * as dotenv from "dotenv";

dotenv.config();

// 1. 使用 AgentTool 接口定义自定义工具
// 这里直接在工具定义中包含执行逻辑
const tools: AgentTool<any>[] = [{
  name: "calculate_area",
  label: "面积计算器", // AgentTool 必需
  description: "计算圆或矩形的面积",
  parameters: Type.Union([
    Type.Object({
      shape: Type.Literal("circle"),
      radius: Type.Number({ description: "圆的半径" })
    }),
    Type.Object({
      shape: Type.Literal("rectangle"),
      width: Type.Number({ description: "矩形的宽度" }),
      height: Type.Number({ description: "矩形的高度" })
    })
  ]),
  execute: async (toolCallId, params) => {
    console.log(`\n[执行工具] calculate_area，参数为:`, params);
    
    let area = 0;
    if (params.shape === "circle") {
      area = Math.PI * Math.pow(params.radius, 2);
    } else if (params.shape === "rectangle") {
      area = params.width * params.height;
    }
    
    const result = area.toFixed(2);
    console.log(`[工具结果] ${result}`);
    
    return {
      content: [{ type: "text", text: `面积是 ${result}` }],
      details: { area: result }
    };
  }
}];

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
    systemPrompt: "你是一个可以计算面积的得力助手。请使用 'calculate_area' 工具进行任何面积计算。",
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
    
    console.log("--- Agent Prompt: 计算半径为 5 的圆的面积 ---");
    try {
        await agent.prompt("计算半径为 5 的圆的面积是多少？");
    } catch (error) {
        console.error("\nAgent 执行过程中出错:", error);
    }
}

main().catch(console.error);
