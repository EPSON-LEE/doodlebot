import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { taskManager } from "../core/taskManager.js";

export const checkTask: AgentTool<any> = {
  name: "check_task_status",
  label: "查看任务状态",
  description:
    "查看后台任务的状态和输出。不传 task_id 则列出所有任务。",
  parameters: Type.Object({
    task_id: Type.Optional(
      Type.String({ description: "后台任务的 ID。如果不传，则列出所有任务。" })
    ),
  }),
  execute: async (id, params) => {
    try {
      if (params.task_id) {
        // 查询单个任务
        const task = taskManager.getTask(params.task_id);
        if (!task) {
          return {
            content: [{ type: "text", text: `未找到任务: ${params.task_id}` }],
            details: { error: "not_found" },
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: taskManager.formatTask(task) }],
          details: task,
        };
      } else {
        // 列出所有任务
        const tasks = taskManager.listTasks();
        if (tasks.length === 0) {
          return {
            content: [{ type: "text", text: "当前没有后台任务。" }],
            details: { tasks: [] },
          };
        }
        const summary = tasks.map((t) => taskManager.formatTask(t)).join("\n\n---\n\n");
        return {
          content: [{ type: "text", text: `共 ${tasks.length} 个任务:\n\n${summary}` }],
          details: { tasks },
        };
      }
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `查询任务失败: ${e.message}` }],
        details: { error: e.message },
        isError: true,
      };
    }
  },
};
