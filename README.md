# React Agent

基于 ReAct（Reasoning + Acting）模式的 AI 助手，使用 Bun + TypeScript 构建，调用 DeepSeek API。

## 项目结构

```
react-agent/
├── src/
│   ├── index.ts           # 程序入口
│   ├── types.ts          # 类型定义
│   ├── prompt.ts         # 系统提示词
│   ├── loop.ts           # ReAct 循环核心
│   ├── llm/
│   │   └── deepseek.ts   # DeepSeek API 调用
│   ├── parser/
│   │   ├── assistant.ts # XML 格式回复解析
│   │   └── writeInput.ts # write 工具参数解析
│   └── tools/
│       ├── mod.ts         # 工具注册表
│       ├── bash.ts        # 执行 shell 命令
│       ├── read.ts        # 读取文件
│       ├── write.ts       # 写入文件
│       ├── fetch.ts       # HTTP GET 请求
│       ├── getTime.ts     # 获取当前 ISO 时间
│       └── ensureParentDir.ts
├── .env                   # 环境变量配置
├── package.json
└── tsconfig.json
```

## 快速开始

### 1. 安装 Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. 配置环境变量

Bun 会自动加载 `.env` 文件，无需额外安装 dotenv。

编辑 `.env` 文件：

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE=https://api.deepseek.com/v1
```

### 3. 运行

```bash
bun run src/index.ts "<your question>"
```

## 使用示例

### 默认模式（仅显示结果）

```bash
bun run src/index.ts "现在几点了？"
bun run src/index.ts "执行 echo hello 命令"
```

### Trace 模式（显示完整执行过程）

```bash
bun run src/index.ts --trace "现在几点了？"
```

输出示例：
```
任务: 现在几点了？

正在启动 ReAct 循环...

[Step 1]
🤔 Thought: 用户想知道当前时间，我需要调用 getTime 工具来获取 ISO 时间。
🔧 Action: getTime({})
📋 Observation: 2026-05-21T07:32:00.000Z

[Step 2]
🤔 Thought: 已获取时间信息，转换为用户友好格式。
✅ Final: 当前时间是 2026年5月21日 07:32（UTC）。

--- 最终结果 ---
当前时间是 2026年5月21日 07:32（UTC）。
```

### 工具使用示例

```bash
# 执行 shell 命令
bun run src/index.ts "列出当前目录文件"

# 读取文件
bun run src/index.ts "读取 src/index.ts"

# 写入文件
bun run src/index.ts "写入文件 test.txt，内容是 hello world"

# HTTP 请求
bun run src/index.ts "获取 https://httpbin.org/get 的内容"
```

## 开发指南

### 添加新工具

1. 在 `src/tools/` 创建工具文件，如 `grep.ts`：

```typescript
// src/tools/grep.ts
export async function grep(pattern: string): Promise<string> {
  // 实现逻辑
  return result;
}
```

2. 在 `src/tools/mod.ts` 注册：

```typescript
import { grep } from './grep.ts';

export const TOOLKIT = {
  // ... existing tools
  grep,
} as const;
```

3. 在 `src/prompt.ts` 添加工具说明到 `SYSTEM_PROMPT`：

```
- grep：在文件中搜索匹配内容，参数为 "pattern path"。
```

### 修改系统提示词

编辑 `src/prompt.ts` 中的 `SYSTEM_PROMPT` 变量。

## Trace 机制

Agent 支持 trace 模式，可以追溯每一步的执行过程：

```bash
# 使用 --trace 参数
bun run src/index.ts --trace "<your question>"

# 使用 -t 简写
bun run src/index.ts -t "<your question>"
```

Trace 输出包含：
- **🤔 Thought**: LLM 的思考过程
- **🔧 Action**: 执行的工具名称和参数
- **📋 Observation**: 工具返回的结果
- **❌ Error**: 执行错误信息（如有）
- **✅ Final**: 最终回答

### 调试工具函数

```bash
# 直接测试工具
bun -e "import { bash } from './src/tools/bash.ts'; bash('ls').then(console.log)"
bun -e "import { getTime } from './src/tools/getTime.ts'; console.log(getTime())"
```

### 监听模式开发

```bash
bun --watch run src/index.ts "<your question>"
```

### ReAct Loop 流程

1. 用户提问 → 添加 system prompt 和问题到消息历史
2. 调用 DeepSeek API 获取回复
3. 解析 XML 格式回复（`<thought>`, `<action>`, `<final>`）
4. 若有 `<action>`：执行工具，将结果作为 `<observation>` 追加
5. 若有 `<final>`：返回最终答案
6. 循环直到得到答案或达到最大步数（10步）

### 工具输入格式

| 工具 | 输入格式 | 示例 |
|------|----------|------|
| getTime | 空 | `{}` |
| bash | 命令字符串或 JSON 数组 | `"echo hello"` 或 `["echo", "hello"]` |
| read | 文件路径 | `"src/index.ts"` |
| write | JSON | `{"path":"test.txt","content":"hello","mode":"overwrite"}` |
| fetch | URL | `"https://example.com"` |

## LLM 配置

编辑 `src/llm/deepseek.ts` 可修改：
- 模型名称
- temperature
- max_tokens

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DEEPSEEK_API_KEY | DeepSeek API 密钥 | - |
| DEEPSEEK_BASE | API Base URL | https://api.deepseek.com/v1 |

## 许可证

MIT