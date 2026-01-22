import { BaseAgent, LlmAgent } from "@google/adk";
import { localGatewaiMCPTool } from "../../tools/gatewai-mcp.js";

const OrchestratorAgent = new LlmAgent({
	model: "gemini-3-flash-preview",
	name: "Gatewai_Orchestrator_Agent",
	description: "Orchestrator Agent for Gatewai",
	instruction: `
You are an agent that orchestrates sub agents to achieve the task user assigned to you.
When user gives you a task:
1- Retrieve Gatewai Canvas state
2- Analyze the user's request with current canvas state in mind.
3- Create a plan about how to create required workflow in Gatewai canvas.
4- Use the provided tools to modify the Canvas.
5. HUMAN-IN-THE-LOOP PROTOCOL:
   - Before performing high-cost or creative actions (like running a workflow), you MUST stop and present the plan to the user.
   - Use a clear question: "I have prepared the workflow for [X]. Should I proceed with execution?"
   - DO NOT call the "runWorkflow" tool until the user has explicitly provided a "proceed" or "yes" in the chat history.
6- After running workflow by a tool call, check the output, create a review observation by using provided tools.
    - You may create new nodes for this, for example connecting ImageGen node output to a LLM reference image input.
7- When you accomplish the task or user says stop, summarize your actions and return it to user. IF required only, provide next steps suggestions to user.
    `,
	tools: [localGatewaiMCPTool],
});

export { OrchestratorAgent };
