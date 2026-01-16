# Seedbed + Farmer 全流程 E2E 测试

> 自动化测试脚本，执行完整的 Seedbed → Farmer → GitHub PR 流程。

## 快速运行

```bash
npx tsx tests/e2e/e2e-runner.ts
```

## 测试配置

| 配置项 | 值 | 环境变量 |
|--------|-----|----------|
| Seedbed | http://localhost:3000 | `SEEDBED_BASE` |
| Farmer | http://localhost:38965 | `FARMER_BASE` |
| 测试仓库 | /Users/yoshiyuki/WebstormProjects/e2e-test-repo | - |
| 测试前缀 | `[E2E-TEST]` | - |

## 测试阶段

| 阶段 | 说明 | 预计耗时 |
|------|------|----------|
| Phase 0 | 环境准备：检查服务、生成 Token、重置仓库 | ~5s |
| Phase 1 | 幂等清理：删除旧 Plans 和 PR（并行） | ~5s |
| Phase 2 | 确保项目：检查或创建测试项目 | ~2s |
| Phase 3 | 创建 Plan：通过聊天 API 创建 Plan 和 Tasks | ~30s |
| Phase 4 | Farmer 执行：等待代码生成和 PR 创建 | ~3-5min |
| Phase 5 | 验证结果：检查 PR 和代码变更 | ~5s |
| Phase 6 | 生成报告：保存测试报告到 reports/ | ~1s |

**总预计耗时：5-6 分钟**

## 期望输出

### 成功

```
🌱 Seedbed + Farmer E2E Test Starting...

==================================================

📋 Phase 0: 环境准备
--------------------------------------------------
✓ [Phase 0] Seedbed: UP (http://localhost:3000)
✓ [Phase 0] Farmer: UP (http://localhost:38965)
✓ [Phase 0] Farmer Worker: UP
✓ [Phase 0] Token 生成成功
✓ [Phase 0] 测试仓库已重置

🧹 Phase 1: 幂等清理
--------------------------------------------------
✓ [Phase 1] 已删除 2 个测试 Plans
✓ [Phase 1] 已关闭 1 个测试 PR

...

==================================================

✅ 测试完成！耗时: 312.5s
```

### 失败

```
❌ 测试失败！耗时: 45.2s

失败阶段: Phase 5: Farmer 执行
错误: Execution timeout
```

## 故障排除

### 服务未运行

```bash
# 启动 Seedbed
cd /Users/yoshiyuki/WebstormProjects/seedbed && pm2 start npm --name "seedbed-dev" -- run dev

# 启动 Farmer
cd /Users/yoshiyuki/WebstormProjects/farmer && pm2 start ecosystem.config.js

# 检查状态
pm2 status
```

### Worker 未处理执行

```bash
# 检查 Worker 日志
pm2 logs farmer-worker --nostream --lines 20

# 检查项目锁
cd /Users/yoshiyuki/WebstormProjects/seedbed
npx tsx -e "
import 'dotenv/config'
import { prisma } from './src/lib/prisma'
const locks = await prisma.projectLock.findMany()
console.log('Active locks:', locks)
prisma.\$disconnect()
"
```

### 手动清理

```bash
# 清理测试 PR
gh pr list --repo YoshiyukiSakura/e2e-test-repo --state open --json number,title \
  | jq -r '.[] | select(.title | contains("[E2E-TEST]")) | .number' \
  | xargs -I {} gh pr close {} --repo YoshiyukiSakura/e2e-test-repo

# 重置测试仓库
cd /Users/yoshiyuki/WebstormProjects/e2e-test-repo
git checkout main && git reset --hard origin/main && git clean -fd
```

### 重试失败的执行

```bash
# 获取 Execution ID（从报告或日志）
EXECUTION_ID="xxx"
FARMER_BASE="http://localhost:38965"
AUTH_TOKEN="your-token"

# 重试全部失败
curl -X POST "$FARMER_BASE/api/execution/$EXECUTION_ID/retry" \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"retryAll": true}'
```

## 测试报告

报告保存在 `tests/e2e/reports/` 目录：

```
tests/e2e/reports/
├── e2e-test-report-20260115.md
└── ...
```

## 成功标准

- [ ] 所有服务运行正常
- [ ] Plan 和 Tasks 创建成功
- [ ] Execution 状态为 COMPLETED
- [ ] GitHub PR 创建成功
- [ ] 测试报告已生成
