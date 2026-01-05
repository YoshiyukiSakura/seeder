/**
 * 测试 5: 使用会话恢复来实现交互
 * 方案：第一次调用获取问题，第二次调用发送回答
 */
const { spawn } = require('child_process');
const crypto = require('crypto');

console.log('=== 测试 5: 会话恢复方案 ===\n');

// 生成会话 ID
const sessionId = crypto.randomUUID();
console.log('会话 ID:', sessionId);

function runClaude(args, input) {
  return new Promise((resolve, reject) => {
    const fullArgs = [
      '--permission-mode', 'plan',
      '--output-format', 'stream-json',
      '--verbose',
      '--session-id', sessionId,
      ...args
    ];

    console.log('\n运行命令: claude', fullArgs.join(' '));
    console.log('输入:', input.substring(0, 100));

    const claude = spawn('claude', fullArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/Users/yoshiyuki/WebstormProjects/seedbed'
    });

    claude.stdin.write(input + '\n');
    claude.stdin.end();

    const messages = [];
    let buffer = '';

    claude.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          messages.push(msg);
          console.log(`  [${messages.length}] type=${msg.type}`);

          // 检测 AskUserQuestion
          if (msg.type === 'assistant' && msg.message?.content) {
            for (const content of msg.message.content) {
              if (content.type === 'tool_use' && content.name === 'AskUserQuestion') {
                console.log('    *** AskUserQuestion ***');
                console.log('    tool_use_id:', content.id);
              }
            }
          }
        } catch (e) {}
      }
    });

    claude.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Error')) {
        console.log('  stderr:', msg.substring(0, 150));
      }
    });

    claude.on('close', (code) => {
      console.log('  退出码:', code);
      resolve({ code, messages });
    });

    claude.on('error', reject);

    setTimeout(() => {
      claude.kill();
      resolve({ code: -1, messages, timeout: true });
    }, 60000);
  });
}

async function main() {
  // 第一次调用：发送问题，期望得到 AskUserQuestion
  console.log('\n--- 第一次调用 ---');
  const result1 = await runClaude(
    ['--print'],
    '帮我规划一个登录功能。先问我几个问题。'
  );

  // 分析第一次调用的结果
  let questionToolUseId = null;
  let questionContent = null;

  for (const msg of result1.messages) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const content of msg.message.content) {
        if (content.type === 'tool_use' && content.name === 'AskUserQuestion') {
          questionToolUseId = content.id;
          questionContent = content.input;
          console.log('\n找到问题!');
          console.log('tool_use_id:', questionToolUseId);
          const q = questionContent.questions?.[0];
          if (q) {
            console.log('问题:', q.question);
            console.log('选项:', q.options?.map(o => o.label).join(', '));
          }
        }
      }
    }
  }

  if (!questionToolUseId) {
    console.log('\n未检测到 AskUserQuestion，测试结束');
    return;
  }

  // 第二次调用：使用 --continue 恢复会话并发送回答
  console.log('\n--- 第二次调用 (恢复会话) ---');
  const answer = questionContent.questions?.[0]?.options?.[0]?.label || '是';
  const result2 = await runClaude(
    ['--print', '--continue'],
    answer
  );

  console.log('\n=== 测试结果 ===');
  console.log('第一次调用消息数:', result1.messages.length);
  console.log('第二次调用消息数:', result2.messages.length);
  console.log('检测到问题:', !!questionToolUseId);

  // 检查第二次调用是否成功
  const hasResult = result2.messages.some(m => m.type === 'result' && m.subtype === 'success');
  console.log('第二次调用成功:', hasResult);
}

main().catch(console.error);
