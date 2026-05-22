// 消息类型
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// LLM 回复解析结果类型
export type ParsedAssistant = {
  thought?: string;
  action?: {
    tool: string;
    input: string;
  };
  final?: string;
};

// 工具名称枚举
export type ToolName = 'queryProduct';

// Trace 步骤
export type TraceStep = {
  step: number;
  thought?: string;
  action?: {
    tool: string;
    input: string;
  };
  observation?: string;
  error?: string;
  final?: string;
};

// 运行结果
export type RunResult = {
  final: string;
  trace: TraceStep[];
};