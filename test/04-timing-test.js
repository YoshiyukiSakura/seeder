/**
 * 测试 4: 探索正确的交互时序
 * 分析消息流，找到正确的回答时机
 */
const { spawn } = require('child_process');

console.log('=== 测试 4: 探索正确的交互时序 ===\n');

// 尝试不使用 --input-format stream-json，只保持输出流
const claude = spawn('claude', [
  '--print',
  '--permission-mode', 'plan',
  '--output-format', 'stream-json',
  '--verbose'
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: '/Users/yoshiyuki/WebstormProjects/seedbed'
});

const prompt = '请问我一个简单的问题来确定接下来的工作方向。';
console.log('发送提示:', prompt);
console.log('(不使用 --input-format stream-json)\n');

// 直接发送纯文本提示
claude.stdin.write(prompt + '\n');
claude.stdin.end();  // 需要关闭 stdin 来触发处理

let messageCount = 0;
let pendingQuestion = null;

claude.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const msg = JSON.parse(line);
      messageCount++;

      console.log(`\n[${messageCount}] type=${msg.type} subtype=${msg.subtype || '-'}`);

      if (msg.type === 'assistant' && msg.message?.content) {
        for (const content of msg.message.content) {
          if (content.type === 'tool_use' && content.name === 'AskUserQuestion') {
            console.log('  *** AskUserQuestion 检测到 ***');
            console.log('  tool_use_id:', content.id);
            pendingQuestion = content;

            const q = content.input.questions?.[0];
            if (q) {
              console.log('  问题:', q.question);
              console.log('  选项:', q.options?.map(o => o.label).join(', '));
            }

            // 立即回答（测试不同时序）
            console.log('\n  立即发送回答...');
            const answer = q?.options?.[0]?.label || '是';
            claude.stdin.write(answer + '\n');
            console.log('  已发送:', answer);
          }

          if (content.type === 'text') {
            console.log('  文本:', content.text.substring(0, 100));
          }
        }
      }

      if (msg.type === 'result') {
        console.log('  结果长度:', msg.result?.length || 0);
        if (msg.result) {
          console.log('  结果预览:', msg.result.substring(0, 200));
        }
      }

    } catch (e) {
      // 非 JSON
    }
  }
});

claude.stderr.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('Error') || msg.includes('error')) {
    console.log('\nstderr:', msg.substring(0, 200));
  }
});

claude.on('close', (code) => {
  console.log('\n=== 结束 ===');
  console.log('退出码:', code);
  console.log('消息数:', messageCount);
  console.log('是否有待处理问题:', pendingQuestion ? '是' : '否');
});

setTimeout(() => {
  console.log('\n超时终止');
  claude.kill();
}, 120000);
