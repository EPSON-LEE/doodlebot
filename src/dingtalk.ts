import {
  DWClient,
  DWClientDownStream,
  EventAck,
  TOPIC_ROBOT,
} from "dingtalk-stream";
import { agent } from "./agent.js";
import { type AgentEvent } from "@mariozechner/pi-agent-core";
import { ARK_CONFIG } from "./config.js";
import { memoryManager } from "./utils/memory.js";
import { PROMPTS } from "./constants/prompts.js";
import { taskManager, type BackgroundTask } from "./core/taskManager.js";

if (!ARK_CONFIG.dingtalkAppKey || !ARK_CONFIG.dingtalkAppSecret) {
  console.error("未发现钉钉应用凭证，请在 .env 文件中设置 DINGTALK_APP_KEY 和 DINGTALK_APP_SECRET。");
  process.exit(1);
}

const client = new DWClient({
  clientId: ARK_CONFIG.dingtalkAppKey,
  clientSecret: ARK_CONFIG.dingtalkAppSecret,
});

/**
 * 通过 sessionWebhook 回复钉钉消息
 */
async function replyToDingtalk(
  sessionWebhook: string,
  senderStaffId: string,
  text: string
) {
  const accessToken = await client.getAccessToken();
  try {
    const response = await fetch(sessionWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": accessToken,
      },
      body: JSON.stringify({
        at: {
          atUserIds: [senderStaffId],
          isAtAll: false,
        },
        text: { content: text },
        msgtype: "text",
      }),
    });
    if (!response.ok) {
      console.error(`钉钉回复失败: ${response.status} ${response.statusText}`);
    }
  } catch (err: any) {
    console.error("钉钉回复异常:", err.message);
  }
}

/**
 * 设置 Agent 事件订阅（钉钉版）
 */
function setupDingtalkSubscriptions(
  sessionWebhook: string,
  senderStaffId: string
) {
  return agent.subscribe((event: AgentEvent) => {
    switch (event.type) {
      case "tool_execution_start":
        replyToDingtalk(
          sessionWebhook,
          senderStaffId,
          `[执行工具] ${event.toolName}...`
        );
        break;

      case "tool_execution_end":
        if (event.isError) {
          replyToDingtalk(
            sessionWebhook,
            senderStaffId,
            `[工具报错] ${event.toolName}`
          );
        }
        break;

      case "turn_end":
        if (event.message.role === "assistant") {
          const content = event.message.content;
          let text = "";
          if (Array.isArray(content)) {
            const textNode = content.find(
              (c) => (c as any).type === "text"
            ) as any;
            text = textNode?.text || "";
          } else if (typeof content === "string") {
            text = content;
          }

          if (text) {
            replyToDingtalk(sessionWebhook, senderStaffId, text);
          }
        }
        memoryManager.save(agent.state.messages);
        break;
    }
  });
}

// 启动逻辑
async function main() {
  console.log("钉钉机器人正在启动...");

  // 加载记忆
  const history = memoryManager.load();
  if (history.length > 0) {
    agent.replaceMessages(history);
    console.log(`[Memory] 已从记忆中恢复 ${history.length} 条消息。`);
  }

  let isAgentRunning = false;
  let lastWebhook: string | null = null;
  let lastSender: string | null = null;

  // 后台任务通知
  taskManager.on("task:done", (task: BackgroundTask) => {
    if (lastWebhook && lastSender) {
      replyToDingtalk(
        lastWebhook,
        lastSender,
        `[后台任务完成] ${task.description}\nTaskID: ${task.id}`
      );
    }
  });

  taskManager.on("task:error", (task: BackgroundTask) => {
    if (lastWebhook && lastSender) {
      const errPreview = task.stderr ? task.stderr.slice(-200) : "未知错误";
      replyToDingtalk(
        lastWebhook,
        lastSender,
        `[后台任务失败] ${task.description}\nTaskID: ${task.id}\n错误: ${errPreview}`
      );
    }
  });

  // 注册机器人回调
  client.registerCallbackListener(
    TOPIC_ROBOT,
    async (res: DWClientDownStream) => {
      const data = JSON.parse(res.data);
      const input = (data.text?.content || "").trim();
      const senderStaffId = data.senderStaffId;
      const sessionWebhook = data.sessionWebhook;

      // 缓存最后的 webhook 和发送者，用于后台任务通知
      lastWebhook = sessionWebhook;
      lastSender = senderStaffId;

      if (!input) {
        client.socketCallBackResponse(res.headers.messageId, { status: "ok" });
        return;
      }

      // /clear 命令
      if (input.toLowerCase() === "/clear") {
        memoryManager.clear();
        agent.replaceMessages([]);
        await replyToDingtalk(sessionWebhook, senderStaffId, "持久化记忆已清空。");
        client.socketCallBackResponse(res.headers.messageId, { status: "ok" });
        return;
      }

      // /start 命令
      if (input.toLowerCase() === "/start") {
        await replyToDingtalk(sessionWebhook, senderStaffId, PROMPTS.TELEGRAM_GREETING);
        client.socketCallBackResponse(res.headers.messageId, { status: "ok" });
        return;
      }

      // /tasks 命令
      if (input.toLowerCase() === "/tasks") {
        const tasks = taskManager.listTasks();
        if (tasks.length === 0) {
          await replyToDingtalk(sessionWebhook, senderStaffId, "当前没有后台任务。");
        } else {
          const summary = tasks.map((t) => taskManager.formatTask(t)).join("\n\n");
          await replyToDingtalk(sessionWebhook, senderStaffId, `后台任务列表:\n\n${summary}`);
        }
        client.socketCallBackResponse(res.headers.messageId, { status: "ok" });
        return;
      }

      // Agent 正在运行中，通过 steer 注入消息
      if (isAgentRunning) {
        agent.steer({
          role: "user",
          content: input,
          timestamp: Date.now(),
        } as any);
        await replyToDingtalk(
          sessionWebhook,
          senderStaffId,
          "[已收到] 你的消息已排队，Agent 将在当前步骤完成后处理。"
        );
        client.socketCallBackResponse(res.headers.messageId, { status: "ok" });
        return;
      }

      // 正常处理
      const unsubscribe = setupDingtalkSubscriptions(sessionWebhook, senderStaffId);
      isAgentRunning = true;

      try {
        await agent.prompt(input);
      } catch (err: any) {
        await replyToDingtalk(sessionWebhook, senderStaffId, `系统异常: ${err.message}`);
      } finally {
        isAgentRunning = false;
        unsubscribe();
      }

      client.socketCallBackResponse(res.headers.messageId, { status: "ok" });
    }
  );

  // 注册所有事件监听（防止未处理的事件导致报错）
  client.registerAllEventListener((message: DWClientDownStream) => {
    return { status: EventAck.SUCCESS };
  });

  // 建立连接
  client.connect();
  console.log("钉钉机器人已上线！可以在钉钉群中 @机器人 发送消息了。");
}

main().catch((err) => console.error("启动失败:", err));
