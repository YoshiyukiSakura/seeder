/**
 * 测试 7: 完整交互流程验证
 * 验证: 第一次调用 → 获取问题 → 第二次调用 (--continue) → 发送回答 → 获取最终结果
 */
const { spawn } = require('child_process');

console.log('=== 测试 7: 完整交互流程验证 ===\n');

function runClaude(args, input, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const fullArgs = [
      '--permission-mode', 'plan',
      '--output-format', 'stream-json',
      '--verbose',
      ...args
    ];

    console.log('运行: claude', fullArgs.filter(a => !a.startsWith('--output')).join(' '));

    const claude = spawn('claude', fullArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/Users/yoshiyuki/WebstormProjects/seedbed'
    });

    claude.stdin.write(input + '\n');
    claude.stdin.end();

    const messages = [];
    let buffer = '';
    let questions = [];
    let finalResult = null;

    claude.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          messages.push(msg);

          if (msg.type === 'assistant' && msg.message?.content) {
            for (const c of msg.message.content) {
              if (c.type === 'tool_use' && c.name === 'AskUserQuestion') {
                questions.push({
                  toolUseId: c.id,
                  questions: c.input.questions
                });
              }
            }
          }

          if (msg.type === 'result' && msg.subtype === 'success') {
            finalResult = msg.result;
          }
        } catch (e) {}
      }
    });

    claude.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Error') && !msg.includes('permission_denied')) {
        console.log('  错误:', msg.substring(0, 100));
      }
    });

    claude.on('close', (code) => {
      resolve({ code, messages, questions, finalResult });
    });

    setTimeout(() => {
      claude.kill();
      resolve({ code: -1, messages, questions, finalResult, timeout: true });
    }, timeout);
  });
}

async function main() {
  console.log('步骤 1: 发送初始请求，期望获取问题');
  console.log('─'.repeat(50));

  const r1 = await runClaude(
    ['--print'],
    '帮我规划一个简单的登录功能。请先问我一个关于认证方式的问题。',
    90000
  );

  console.log('  消息数:', r1.messages.length);
  console.log('  检测到问题:', r1.questions.length);
  console.log('  退出码:', r1.code);

  if (r1.questions.length === 0) {
    console.log('\n未检测到 AskUserQuestion，测试失败');
    return false;
  }

  const q = r1.questions[0].questions[0];
  console.log('\n  问题:', q.question);
  console.log('  选项:', q.options?.map(o => o.label).join(' | '));

  const answer = q.options?.[0]?.label || 'GitHub OAuth';
  console.log('\n步骤 2: 使用 --continue 发送回答');
  console.log('─'.repeat(50));
  console.log('  回答:', answer);

  const r2 = await runClaude(
    ['--print', '--continue'],
    answer,
    120000
  );

  console.log('\n  消息数:', r2.messages.length);
  console.log('  退出码:', r2.code);
  console.log('  有最终结果:', !!r2.finalResult);

  if (r2.finalResult) {
    console.log('\n步骤 3: 最终结果');
    console.log('─'.repeat(50));
    console.log(r2.finalResult.substring(0, 600));
    if (r2.finalResult.length > 600) console.log('...(截断)');
  }

  // 验证结果
  console.log('\n' + '═'.repeat(50));
  console.log('验证结果');
  console.log('═'.repeat(50));

  const success = r1.questions.length > 0 && r2.messages.length > 0;

  console.log('✓ 能够捕获 stream-json 输出:', r1.messages.length > 0);
  console.log('✓ 能够检测 AskUserQuestion:', r1.questions.length > 0);
  console.log('✓ 能够使用 --continue 恢复会话:', r2.messages.length > 0);
  console.log('✓ Claude 理解了用户回答:', r2.messages.some(m =>
    m.type === 'assistant' && m.message?.content?.some(c =>
      c.type === 'text' && (c.text.includes('OAuth') || c.text.includes('GitHub'))
    )
  ));
  console.log('✓ 获得最终结果:', !!r2.finalResult);

  console.log('\n整体验证:', success ? '通过' : '部分通过');

  return success;
}

main()
  .then(success => {
    console.log('\n测试结束');
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('测试错误:', err);
    process.exit(1);
  });
