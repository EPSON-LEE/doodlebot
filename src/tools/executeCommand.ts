import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const executeCommand: AgentTool<any> = {
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
};
