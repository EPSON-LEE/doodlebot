import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { skillManager } from "../utils/skillManager.js";

export const readSkill: AgentTool<any> = {
  name: "read_skill",
  label: "查阅技能",
  description: "当你想使用某个特定技能时，可以通过此工具读取该技能的详细指南。你需要提供技能的名称。",
  parameters: Type.Object({
    skillName: Type.String({ description: "技能的名称 (lowercase, hyphens only)" })
  }),
  execute: async (id, params) => {
    const content = skillManager.getSkillContent(params.skillName);
    if (!content) {
      return {
        content: [{ type: "text", text: `未找到名为 "${params.skillName}" 的技能。请先通过查询可用技能确定名称。` }],
        details: { success: false },
        isError: true
      };
    }
    return {
      content: [{ type: "text", text: `技能 "${params.skillName}" 的内容如下：\n\n${content}` }],
      details: { skillName: params.skillName, success: true }
    };
  }
};
