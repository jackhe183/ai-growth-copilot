import type { ChatMessage } from '../types.ts';

const MODEL = 'deepseek-v4-pro';

// Cloudflare Workers 环境变量通过全局变量传入
declare const DEEPSEEK_API_KEY: string | undefined;
declare const DEEPSEEK_BASE: string | undefined;

export async function callDeepSeek(messages: ChatMessage[]): Promise<string> {
  // 优先使用全局变量（Cloudflare Workers），其次使用 Bun.env（本地开发）
  const apiKey = (typeof DEEPSEEK_API_KEY !== 'undefined' ? DEEPSEEK_API_KEY : undefined) || (typeof Bun !== 'undefined' ? Bun.env.DEEPSEEK_API_KEY : undefined);

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY environment variable is not set');
  }

  const baseUrl = (typeof DEEPSEEK_BASE !== 'undefined' ? DEEPSEEK_BASE : undefined) || (typeof Bun !== 'undefined' ? Bun.env.DEEPSEEK_BASE : undefined) || 'https://api.deepseek.com/v1';
  const apiUrl = `${baseUrl}/chat/completions`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}