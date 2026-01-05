/**
 * 测试 2: 检测 AskUserQuestion 事件
 * 发送一个模糊需求，期望 Claude 会使用 AskUserQuestion 提问
 */
const { spawn } = require('child_process');

console.log('=== 测试 2: 检测 AskUserQuestion 事件 ===\n');

const claude = spawn('claude', [
  '--print',
  '--permission-mode', 'plan',
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--verbose'
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: '/Users/yoshiyuki/WebstormProjects/seeder'
});

// 发送一个模糊需求，期望 Claude 会提问
const promptText = `我想给这个项目添加一个新功能。请先问我一些问题来了解具体需求，比如功能类型、技术选型等。`;
console.log('发送提示:', promptText);
console.log('期望行为: Claude 应该使用 AskUserQuestion 工具来提问\n');

// 使用 JSON 格式发送初始消息
const initialMessage = {
  type: 'user',
  message: {
    role: 'user',
    content: promptText
  }
};
claude.stdin.write(JSON.stringify(initialMessage) + '\n');
// 注意：不要 end stdin，保持开放以便后续输入

let waitingForInput = false;
let pendingToolUseId = null;
let messageCount = 0;
let askUserQuestionDetected = false;

claude.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const msg = JSON.parse(line);
      messageCount++;
      console.log(`\n[消息 ${messageCount}] 类型: ${msg.type}`);

      // 检测 AskUserQuestion
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const content of msg.message.content) {
          if (content.type === 'tool_use') {
            console.log('  工具调用:', content.name);

            if (content.name === 'AskUserQuestion') {
              askUserQuestionDetected = true;
              waitingForInput = true;
              pendingToolUseId = content.id;

              console.log('\n  *** 检测到 AskUserQuestion! ***');
              console.log('  Tool Use ID:', content.id);
              console.log('  问题内容:');

              const questions = content.input.questions || [];
              for (const q of questions) {
                console.log(`    [${q.header}] ${q.question}`);
                if (q.options) {
                  q.options.forEach((opt, i) => {
                    console.log(`      ${i + 1}. ${opt.label}: ${opt.description || ''}`);
                  });
                }
              }

              // 3秒后自动回答
              console.log('\n  将在 3 秒后自动回答...');
              setTimeout(() => {
                const answer = {
                  type: 'user',
                  message: {
                    role: 'user',
                    content: [{
                      type: 'tool_result',
                      tool_use_id: pendingToolUseId,
                      content: JSON.stringify({
                        answers: {
                          [questions[0]?.question || 'q1']: '用户认证功能'
                        }
                      })
                    }]
                  }
                };
                console.log('\n发送回答:', '用户认证功能');
                claude.stdin.write(JSON.stringify(answer) + '\n');
              }, 3000);
            }
          }

          if (content.type === 'text') {
            console.log('  文本:', content.text.substring(0, 150) + (content.text.length > 150 ? '...' : ''));
          }
        }
      }

      // 检测最终结果
      if (msg.type === 'result') {
        console.log('\n收到最终结果');
        console.log('  结果长度:', msg.result?.length || 0, '字符');
      }

    } catch (e) {
      // 非 JSON 行
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
  console.log('检测到 AskUserQuestion:', askUserQuestionDetected);
  console.log('测试', askUserQuestionDetected ? '通过' : '未检测到 AskUserQuestion (可能需要更明确的提示)');
});

// 超时处理
setTimeout(() => {
  console.log('\n超时，终止进程');
  claude.kill();
}, 120000);
