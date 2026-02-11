import { Agent } from "@mariozechner/pi-agent-core";
import { type AgentEvent } from "@mariozechner/pi-agent-core";
import { ARK_CONFIG } from "./config.js";
import { agentTools } from "./tools/index.js";
import { Colors } from "./constants/colors.js";
import { PROMPTS } from "./constants/prompts.js";
import { logger } from "./utils/logger.js";
import { memoryManager } from "./utils/memory.js";
import { skillManager } from "./utils/skillManager.js";

// 获取初始化时的技能列表
const availableSkills = skillManager.discoverSkills();
const skillContext = availableSkills.length > 0 
  ? `\n你可以使用以下技能（Skills），如果需要详细的操作流程，请调用 read_skill 工具：\n${availableSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')}`
  : "";

// 1. 初始化 Agent
export const agent = new Agent({
  initialState: {
    systemPrompt: PROMPTS.getSystemPrompt(skillContext),
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
  transformContext: async (messages) => {
    logger.llmCall(messages);
    return messages;
  },
  getApiKey: (p) => (p === "openai" ? ARK_CONFIG.apiKey : undefined)
});

let hasStreamed = false;

// 2. 核心事件引擎
export function setupAgentSubscriptions() {
  agent.subscribe((event: AgentEvent) => {
    switch (event.type) {
      case "turn_start":
        hasStreamed = false;
        break;

      case "message_start":
        if (event.message.role === "assistant") {
          process.stdout.write(`${Colors.dim}AI 正在思考...\r`);
        }
        break;

      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          if (event.assistantMessageEvent.delta) {
            if (!hasStreamed) {
              process.stdout.write(" ".repeat(20) + "\r");
            }
            hasStreamed = true;
            logger.agent(event.assistantMessageEvent.delta);
          }
        }
        break;
        
      case "tool_execution_start":
        hasStreamed = true;
        logger.tool(event.toolName, event.args);
        break;
        
      case "tool_execution_end":
        logger.result(event.toolName, event.result);
        break;
        
      case "turn_end":
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
            logger.error("Agent 运行完成，但未返回任何内容或工具调用。");
          }
        }
        process.stdout.write("\n"); 
        memoryManager.save(agent.state.messages);
        break;
    }
  });
}
