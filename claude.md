# Seeder 项目说明

## 部署规则

**严禁使用 rsync 部署代码到远程服务器！** rsync 会覆盖远程的 .env 等配置文件，导致生产环境故障。

正确的部署流程：
1. 本地 commit 并 push 到 GitHub
2. 在远程服务器上 git pull
3. 重启相关服务

## Dev Server

**重要：Dev server 必须使用 pm2 管理，不要直接用 npm run dev**

```bash
# 启动/重启 dev server
pm2 restart seeder-dev

# 查看日志
pm2 logs seeder-dev --nostream

# 查看状态
pm2 show seeder-dev
```

服务地址：http://localhost:38966

## 项目结构

- `src/app/` - Next.js App Router 页面和 API
- `src/lib/` - 工具库和核心逻辑
- `src/components/` - React 组件
- `tests/` - 测试文件

## 功能说明

### 图片上传 (2026-01-18)

支持在聊天中上传图片：
- 文件选择、粘贴 (Cmd+V)、拖放三种方式
- 上传进度实时显示
- 临时文件自动清理（1小时过期，每10分钟检查）

相关文件：
- `src/app/api/images/upload/route.ts` - 上传 API
- `src/lib/upload.ts` - 前端上传逻辑
- `src/lib/temp-file-cleanup.ts` - 临时文件清理
- `src/components/progress/UploadProgress.tsx` - 进度组件
