/**
 * 测试 3: 完整交互流程验证
 * 验证双向透传：Claude 提问 → 用户回答 → Claude 继续处理
 */
const { spawn } = require('child_process');

console.log('=== 测试 3: 完整交互流程验证 ===\n');

class ClaudeInteraction {
  constructor(cwd) {
    this.cwd = cwd;
    this.process = null;
    this.messageCount = 0;
    this.questionCount = 0;
    this.answerCount = 0;
  }

  async start(prompt) {
    return new Promise((resolve, reject) => {
      this.process = spawn('claude', [
        '--print',
        '--permission-mode', 'plan',
        '--output-format', 'stream-json',
        '--input-format', 'stream-json',
        '--verbose'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.cwd
      });

      console.log('发送初始提示:', prompt, '\n');

      // 发送初始消息 (JSON 格式)
      const initialMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: prompt
        }
      };
      this.process.stdin.write(JSON.stringify(initialMessage) + '\n');

      let buffer = '';
      let result = null;
      let lastQuestionAnswered = false;

      this.process.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            this.messageCount++;

            // 处理不同类型的消息
            const eventInfo = this.handleMessage(msg);

            // 如果检测到问题且未回答，自动回答
            if (eventInfo?.needsAnswer && !lastQuestionAnswered) {
              lastQuestionAnswered = true;
              setTimeout(() => {
                this.answerQuestion(eventInfo.toolUseId, eventInfo.answer);
                lastQuestionAnswered = false;
              }, 2000);
            }

            if (msg.type === 'result' && msg.subtype === 'success') {
              result = msg.result;
            }
          } catch (e) {
            // 非 JSON 行，忽略
          }
        }
      });

      this.process.stderr.on('data', (data) => {
        const stderr = data.toString();
        if (stderr.includes('Error')) {
          console.log('\nstderr:', stderr);
        }
      });

      this.process.on('close', (code) => {
        console.log('\n=== 进程结束 ===');
        console.log('退出码:', code);
        console.log('总消息数:', this.messageCount);
        console.log('检测到问题数:', this.questionCount);
        console.log('发送回答数:', this.answerCount);

        if (result) {
          resolve(result);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      this.process.on('error', reject);

      // 超时处理
      setTimeout(() => {
        console.log('\n超时，终止进程');
        this.process.kill();
      }, 180000);
    });
  }

  handleMessage(msg) {
    const prefix = `[${this.messageCount}] [${msg.type}]`;

    switch (msg.type) {
      case 'system':
        if (msg.subtype === 'init') {
          console.log(prefix, '初始化, 工具数:', msg.tools?.length || 0);
        }
        break;

      case 'assistant':
        if (msg.message?.content) {
          for (const content of msg.message.content) {
            if (content.type === 'text') {
              const text = content.text;
              console.log(prefix, '文本:', text.substring(0, 80) + (text.length > 80 ? '...' : ''));
            }

            if (content.type === 'tool_use') {
              console.log(prefix, '工具:', content.name);

              if (content.name === 'AskUserQuestion') {
                this.questionCount++;
                console.log('\n  *** 检测到第', this.questionCount, '个问题 ***');

                const questions = content.input.questions || [];
                let selectedAnswer = '';

                for (const q of questions) {
                  console.log(`  [${q.header}] ${q.question}`);
                  if (q.options && q.options.length > 0) {
                    q.options.forEach((opt, i) => {
                      console.log(`    ${i + 1}. ${opt.label}`);
                    });
                    // 选择第一个选项作为答案
                    selectedAnswer = q.options[0].label;
                  }
                }

                console.log('  将选择:', selectedAnswer || '默认回答');

                return {
                  needsAnswer: true,
                  toolUseId: content.id,
                  answer: selectedAnswer || '是的，继续'
                };
              }
            }
          }
        }
        break;

      case 'user':
        // 工具结果，通常不需要特别处理
        break;

      case 'result':
        if (msg.subtype === 'success') {
          console.log(prefix, '成功! 结果长度:', msg.result?.length || 0, '字符');
        } else if (msg.subtype === 'error') {
          console.log(prefix, '错误:', msg.error);
        }
        break;
    }

    return null;
  }

  answerQuestion(toolUseId, answer) {
    this.answerCount++;
    console.log('\n  >>> 发送回答 #' + this.answerCount + ':', answer);

    // 正确的 tool_result 格式
    const response = {
      type: 'user',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: answer
        }]
      }
    };

    this.process.stdin.write(JSON.stringify(response) + '\n');
  }

  kill() {
    if (this.process) {
      this.process.kill();
    }
  }
}

// 运行测试
async function main() {
  const interaction = new ClaudeInteraction('/Users/yoshiyuki/WebstormProjects/seedbed');

  try {
    const result = await interaction.start(
      '请帮我规划实现一个简单的用户登录功能。在开始之前，请问我几个关键问题来确定技术细节。'
    );

    console.log('\n=== 最终结果 ===');
    console.log(result?.substring(0, 500) || '无结果');
    console.log('\n测试通过: 完整交互流程验证成功！');

  } catch (error) {
    console.error('\n测试失败:', error.message);
  }
}

main();
