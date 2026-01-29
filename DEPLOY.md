# Seeder 部署指南

## 生产环境

- **URL**: https://copilot.wildmeta.ai/seeder
- **服务器**: ubuntu@15.235.212.36
- **应用目录**: /home/ubuntu/apps/seeder
- **端口**: 38966
- **PM2 进程名**: seeder

## 部署方法

### 方式一：运行部署脚本

```bash
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && bash scripts/deploy.sh"
```

### 方式二：一行命令

```bash
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && git pull && npm ci --legacy-peer-deps && npx prisma generate && npx prisma migrate deploy && npm run build && pm2 restart seeder"
```

## 常用运维命令

```bash
# 查看日志
ssh ubuntu@15.235.212.36 "pm2 logs seeder --nostream --lines 50"

# 重启服务
ssh ubuntu@15.235.212.36 "pm2 restart seeder"

# 查看状态
ssh ubuntu@15.235.212.36 "pm2 status seeder"
```

## 数据库

- **类型**: PostgreSQL (Docker)
- **连接**: postgresql://hbot:hummingbot-api@localhost:5432/seeder

```bash
# 进入数据库
ssh ubuntu@15.235.212.36 "docker exec -it hummingbot-postgres psql -U hbot -d seeder"
```
