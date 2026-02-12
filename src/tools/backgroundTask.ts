import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { taskManager } from "../core/taskManager.js";

export const backgroundTask: AgentTool<any> = {
  name: "run_background_task",
  label: "后台任务",
  description:
    "在后台子进程中启动一个耗时的 shell 命令（如 build、clone、数据处理），立即返回 TaskID。适用于预计执行超过 10 秒的命令。对于快速命令（如 ls, cat），请使用 execute_command。",
  parameters: Type.Object({
    command: Type.String({ description: "要执行的 shell 命令" }),
    description: Type.String({ description: "任务的简短描述，例如 '编译项目' 或 '克隆仓库'" }),
  }),
  execute: async (id, params) => {
    try {
      const task = taskManager.spawn(params.command, params.description);
      return {
        content: [
          {
            type: "text",
            text: `后台任务已启动。\nTaskID: ${task.id}\n描述: ${task.description}\nPID: ${task.pid}\n\n用户可以继续与你对话，你可以稍后用 check_task_status 查看进度。`,
          },
        ],
        details: { taskId: task.id, pid: task.pid },
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `启动后台任务失败: ${e.message}` }],
        details: { error: e.message },
        isError: true,
      };
    }
  },
};
