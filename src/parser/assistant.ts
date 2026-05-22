import type { ParsedAssistant } from '../types.ts';

export function parseAssistant(content: string): ParsedAssistant {
  const result: ParsedAssistant = {};

  // 解析 <thought> 标签
  const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/i);
  if (thoughtMatch) {
    result.thought = thoughtMatch[1].trim();
  }

  // 解析 <action> 标签
  const actionMatch = content.match(/<action\s+tool=["']?([^"'\s>]+)["']?\s*>([\s\S]*?)<\/action>/i);
  if (actionMatch) {
    result.action = {
      tool: actionMatch[1].trim(), // 保持原始大小写
      input: actionMatch[2].trim(),
    };
  }

  // 解析 <final> 标签
  const finalMatch = content.match(/<final>([\s\S]*?)<\/final>/i);
  if (finalMatch) {
    result.final = finalMatch[1].trim();
  }

  return result;
}