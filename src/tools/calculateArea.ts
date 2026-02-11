import { type AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";

export const calculateArea: AgentTool<any> = {
  name: "calculate_area",
  label: "面积计算器",
  description: "计算圆或矩形的面积",
  parameters: Type.Union([
    Type.Object({ shape: Type.Literal("circle"), radius: Type.Number() }),
    Type.Object({ shape: Type.Literal("rectangle"), width: Type.Number(), height: Type.Number() })
  ]),
  execute: async (id, params) => {
    const area = params.shape === "circle" ? Math.PI * params.radius ** 2 : params.width * params.height;
    const res = area.toFixed(2);
    return { 
      content: [{ type: "text", text: `计算结果为 ${res}` }],
      details: { area: res }
    };
  }
};
