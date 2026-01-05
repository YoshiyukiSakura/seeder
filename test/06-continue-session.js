/**
 * 测试 6: 使用 --continue 恢复会话
 */
const { spawn } = require('child_process');

console.log('=== 测试 6: --continue 恢复会话 ===\n');

function runClaude(args, input) {
  return new Promise((resolve, reject) => {
    const fullArgs = [
      '--permission-mode', 'plan',
      '--output-format', 'stream-json',
      '--verbose',
      ...args
    ];

    console.log('\n运行: claude', fullArgs.join(' '));
    console.log('输入:', input.substring(0, 80));

    const claude = spawn('claude', fullArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/Users/yoshiyuki/WebstormProjects/seedbed'
    });

    claude.stdin.write(input + '\n');
    claude.stdin.end();

    const messages = [];
    let buffer = '';
    let questionDetected = null;

    claude.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          messages.push(msg);

          // 简洁输出
          if (msg.type === 'assistant' && msg.message?.content) {
            for (const c of msg.message.content) {
              if (c.type === 'tool_use' && c.name === 'AskUserQuestion') {
                questionDetected = c;
                console.log(`  [${messages.length}] *** AskUserQuestion ***`);
                const q = c.input.questions?.[0];
                if (q) console.log('    问题:', q.question);
              } else if (c.type === 'tool_use') {
                console.log(`  [${messages.length}] 工具: ${c.name}`);
              } else if (c.type === 'text') {
                console.log(`  [${messages.length}] 文本: ${c.text.substring(0, 60)}...`);
              }
            }
          } else if (msg.type === 'result') {
            console.log(`  [${messages.length}] 结果: ${msg.subtype}, 长度=${msg.result?.length || 0}`);
          } else if (msg.type === 'system' && msg.subtype === 'init') {
            console.log(`  [${messages.length}] 系统初始化`);
          }
        } catch (e) {}
      }
    });

    claude.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Error') || msg.includes('error')) {
        console.log('  stderr:', msg.substring(0, 120));
      }
    });

    claude.on('close', (code) => {
      console.log('  退出码:', code);
      resolve({ code, messages, questionDetected });
    });

    setTimeout(() => {
      claude.kill();
      resolve({ code: -1, messages, timeout: true, questionDetected });
    }, 90000);
  });
}

async function main() {
  // 第一次调用
  console.log('--- 第一次调用 ---');
  const r1 = await runClaude(['--print'], '帮我规划登录功能，先问我一个问题。');

  if (!r1.questionDetected) {
    console.log('\n未检测到问题，测试结束');
    return;
  }

  const answer = r1.questionDetected.input.questions?.[0]?.options?.[0]?.label || 'GitHub OAuth';
  console.log('\n将回答:', answer);

  // 第二次调用 - 使用 --continue
  console.log('\n--- 第二次调用 (--continue) ---');
  const r2 = await runClaude(['--print', '--continue'], answer);

  console.log('\n=== 结果 ===');
  console.log('第一次消息数:', r1.messages.length);
  console.log('第二次消息数:', r2.messages.length);

  // 检查是否有成功的结果
  const hasSuccessResult = r2.messages.some(m => m.type === 'result' && m.subtype === 'success');
  console.log('第二次有成功结果:', hasSuccessResult);
}

main().catch(console.error);
