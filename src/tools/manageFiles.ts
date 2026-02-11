import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import * as fs from "fs/promises";
import * as path from "path";

export const manageFiles: AgentTool<any> = {
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
};
