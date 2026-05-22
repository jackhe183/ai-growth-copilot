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

// 流式事件类型
export type StreamEvent =
  | { type: 'step'; step: TraceStep }
  | { type: 'token'; token: string }
  | { type: 'done'; final: string; trace: TraceStep[] }
  | { type: 'error'; message: string };

// 流式 Agent 循环
export async function* runAgentStream(question: string): AsyncGenerator<StreamEvent> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question },
  ];

  const trace: TraceStep[] = [];
  let buffer = '';
  let inFinalTag = false;
  let currentStep = 0;
  let finalContent = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    currentStep = step + 1;
    const traceStep: TraceStep = { step: currentStep };
    let fullResponse = '';
    // 每个 step 开始时重置状态
    buffer = '';
    inFinalTag = false;
    finalContent = '';

    // 流式调用 LLM
    let lastYieldIndex = 0; // 追踪已输出的 token 位置
    for await (const token of callDeepSeekStream(messages)) {
      fullResponse += token;
      buffer += token;

      // 检测 <final> 开始
      if (!inFinalTag && buffer.includes('<final>')) {
        const beforeFinal = buffer.split('<final>')[0];
        const parsed = parseAssistant(beforeFinal);
        if (parsed.thought) {
          traceStep.thought = parsed.thought;
        }
        if (parsed.action) {
          traceStep.action = {
            tool: parsed.action.tool,
            input: parsed.action.input,
          };
        }
        buffer = buffer.substring(buffer.indexOf('<final>') + 7);
        inFinalTag = true;
        lastYieldIndex = 0; // 重置
      }

      // 在 final 标签内，yield token
      if (inFinalTag) {
        // 找到 </final> 结束标签
        if (buffer.includes('</final>')) {
          const endIndex = buffer.indexOf('</final>');
          const finalText = buffer.substring(0, endIndex);
          buffer = buffer.substring(endIndex + 8);
          inFinalTag = false;

          if (finalText) {
            finalContent += finalText;
            yield { type: 'token', token: finalText };
          }

          traceStep.final = finalContent;
          trace.push(traceStep);
          yield { type: 'step', step: traceStep };
          yield { type: 'done', final: finalContent, trace };
          return;
        } else {
          // 还没有结束标签，yield 新内容（只 yield 从 lastYieldIndex 之后的内容）
          const newContent = buffer.substring(lastYieldIndex);
          if (newContent) {
            finalContent += newContent;
            yield { type: 'token', token: newContent };
            lastYieldIndex = buffer.length;
          }
        }
      }
    }

    // 流式循环结束，检查是否已经处理过 final
    if (inFinalTag && finalContent) {
      traceStep.final = finalContent;
      trace.push(traceStep);
      yield { type: 'step', step: traceStep };
      yield { type: 'done', final: finalContent, trace };
      return;
    }

    // 如果完整响应还没进入 final 阶段，解析并处理 action
    if (!inFinalTag) {
      const parsed = parseAssistant(fullResponse);
      traceStep.thought = parsed.thought;

      if (parsed.final) {
        traceStep.final = parsed.final;
        trace.push(traceStep);
        yield { type: 'step', step: traceStep };
        yield { type: 'done', final: parsed.final, trace };
        return;
      }

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
          yield { type: 'step', step: traceStep };
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
        yield { type: 'step', step: traceStep };
        continue;
      }

      // 未生成有效输出
      traceStep.error = 'No valid output';
      trace.push(traceStep);
      yield { type: 'step', step: traceStep };
      break;
    }
  }

  yield { type: 'error', message: '未能生成最终回答，请重试或调整问题。' };
}

// 导入流式调用函数
import { callDeepSeekStream } from './llm/deepseek.ts';