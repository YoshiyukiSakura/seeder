# Deploy Skill

部署代码到远程服务器。

## 使用方法

```
/deploy [component]
```

component 可选值：
- `slack-bot` - 部署 Slack Bot
- `seeder` - 部署主应用
- `all` - 部署所有组件

## 执行流程

1. 在本地运行 `git push` 确保代码已推送
2. SSH 到服务器执行部署命令（后台运行，避免超时）
3. 等待部署完成并检查状态

## 服务器信息

- Host: ubuntu@15.235.212.36
- 应用目录: /home/ubuntu/apps/seeder

## 部署命令

根据 $ARGUMENTS 参数执行对应的部署：

### slack-bot
```bash
# 先确保本地代码已推送
git push 2>/dev/null || true

# 后台执行部署，避免 SSH 超时问题
ssh ubuntu@15.235.212.36 'bash -s' << 'DEPLOY_SCRIPT'
cd /home/ubuntu/apps/seeder/slack-bot
git pull
npm run build
pm2 restart seeder-slack-bot
pm2 logs seeder-slack-bot --nostream --lines 10
DEPLOY_SCRIPT
```

### seeder
```bash
git push 2>/dev/null || true

ssh ubuntu@15.235.212.36 'bash -s' << 'DEPLOY_SCRIPT'
cd /home/ubuntu/apps/seeder
git pull
npm run build
pm2 restart seeder-dev
pm2 logs seeder-dev --nostream --lines 10
DEPLOY_SCRIPT
```

### all
同时部署 slack-bot 和 seeder。

## 注意事项

- 部署前确保本地已 commit
- 不要使用 rsync，会覆盖远程 .env 文件
- 部署后检查 pm2 logs 确认服务正常
