import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { taskManager } from "../core/taskManager.js";

export const cancelTask: AgentTool<any> = {
  name: "cancel_task",
  label: "取消任务",
  description: "取消一个正在运行的后台任务。先发送 SIGTERM，2 秒后若未退出则 SIGKILL。",
  parameters: Type.Object({
    task_id: Type.String({ description: "要取消的后台任务 ID" }),
  }),
  execute: async (id, params) => {
    try {
      const success = taskManager.cancelTask(params.task_id);
      if (success) {
        return {
          content: [{ type: "text", text: `任务 ${params.task_id} 已发送取消信号。` }],
          details: { cancelled: true },
        };
      } else {
        const task = taskManager.getTask(params.task_id);
        const reason = task
          ? `任务当前状态为 "${task.status}"，无法取消（只有 running 状态的任务可以取消）。`
          : `未找到任务 ${params.task_id}。`;
        return {
          content: [{ type: "text", text: reason }],
          details: { cancelled: false },
          isError: true,
        };
      }
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `取消任务失败: ${e.message}` }],
        details: { error: e.message },
        isError: true,
      };
    }
  },
};
