import type { ChatMessage, RunResult, TraceStep } from './types.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import { callDeepSeek } from './llm/deepseek.ts';
import { parseAssistant } from './parser/assistant.ts';
import { TOOLKIT } from './tools/mod.ts';

const MAX_STEPS = 10;

export async function runAgent(
  question: string,
  onStep?: (step: TraceStep) => void
): Promise<RunResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question },
  ];

  const trace: TraceStep[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const traceStep: TraceStep = { step: step + 1 };

    // 调用 LLM
    const response = await callDeepSeek(messages);
    messages.push({ role: 'assistant', content: response });

    // 解析回复
    const parsed = parseAssistant(response);
    traceStep.thought = parsed.thought;

    // 如果有 final 标签，直接返回
    if (parsed.final) {
      trace.push(traceStep);
      traceStep.final = parsed.final;
      onStep?.(traceStep);
      return { final: parsed.final, trace };
    }

    // 如果有 action 标签，执行工具
    if (parsed.action) {
      traceStep.action = {
        tool: parsed.action.tool,
        input: parsed.action.input,
      };

      const toolNameLower = parsed.action.tool.toLowerCase() as keyof typeof TOOLKIT;
      const toolFunc = TOOLKIT[toolNameLower];

      if (!toolFunc) {
        const errorMsg = `未知工具: ${parsed.action.tool}`;
        traceStep.error = errorMsg;
        messages.push({
          role: 'user',
          content: `<observation>Error: ${errorMsg}</observation>`,
        });
        trace.push(traceStep);
        onStep?.(traceStep);
        continue;
      }

      try {
        const result = await toolFunc(parsed.action.input);
        traceStep.observation = result;
        messages.push({ role: 'user', content: `<observation>${result}</observation>` });
      } catch (error) {
        traceStep.error = error instanceof Error ? error.message : String(error);
        messages.push({
          role: 'user',
          content: `<observation>Tool execution failed: ${traceStep.error}</observation>`,
        });
      }
      trace.push(traceStep);
      onStep?.(traceStep);
      continue;
    }

    // 未生成有效输出，终止循环
    traceStep.error = 'No valid output';
    trace.push(traceStep);
    onStep?.(traceStep);
    break;
  }

  return { final: '未能生成最终回答，请重试或调整问题。', trace };
}