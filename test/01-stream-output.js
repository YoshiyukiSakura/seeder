/**
 * 测试 1: 基础流式输出捕获
 * 验证能否捕获 Claude CLI 的 stream-json 输出
 */
const { spawn } = require('child_process');

console.log('=== 测试 1: 基础流式输出捕获 ===\n');

const claude = spawn('claude', [
  '--print',
  '--permission-mode', 'plan',
  '--output-format', 'stream-json',
  '--verbose'
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: '/Users/yoshiyuki/WebstormProjects/seeder'
});

// 发送一个简单提示
const prompt = '列出这个项目的文件结构';
console.log('发送提示:', prompt);
claude.stdin.write(prompt + '\n');
claude.stdin.end();

let buffer = '';
let messageCount = 0;
let messageTypes = new Set();

claude.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (line.trim()) {
      messageCount++;
      try {
        const msg = JSON.parse(line);
        messageTypes.add(msg.type);
        console.log(`\n[消息 ${messageCount}] 类型: ${msg.type}`);

        if (msg.type === 'system') {
          console.log('  子类型:', msg.subtype);
          if (msg.tools) {
            console.log('  可用工具数:', msg.tools.length);
          }
        }

        if (msg.type === 'assistant' && msg.message?.content) {
          for (const content of msg.message.content) {
            if (content.type === 'text') {
              console.log('  文本内容:', content.text.substring(0, 100) + '...');
            }
            if (content.type === 'tool_use') {
              console.log('  工具调用:', content.name);
            }
          }
        }

        if (msg.type === 'result') {
          console.log('  结果长度:', msg.result?.length || 0, '字符');
        }
      } catch (e) {
        console.log(`\n[消息 ${messageCount}] 非 JSON:`, line.substring(0, 100));
      }
    }
  }
});

claude.stderr.on('data', (data) => {
  console.error('stderr:', data.toString());
});

claude.on('close', (code) => {
  console.log('\n=== 测试结果 ===');
  console.log('进程退出码:', code);
  console.log('收到消息数:', messageCount);
  console.log('消息类型:', Array.from(messageTypes).join(', '));
  console.log('测试', code === 0 ? '通过' : '失败');
});

// 超时处理
setTimeout(() => {
  console.log('\n超时，终止进程');
  claude.kill();
}, 120000);
