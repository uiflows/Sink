# 部署操作

固定上游基线 Sink v0.3.1，使用 Node 24+、pnpm 11.11.0 和仓库锁文件。保留原版后台。实际账号、资源 ID、部署版本和运行证据存入操作者私有记录，不写入公开仓库。

## 部署边界

优先使用操作者明确选择的 Cloudflare MCP 连接。MCP 缺少的操作，仅在已获授权时使用浏览器。构建成功和本地预览均不代表线上验收完成。付费升级、正式域名或现有生产系统变更需要另行授权。

生成器仅允许 sink-brand 和 sink-marketing，要求显式 DEPLOY_CF_ACCOUNT_ID，校验 D1/KV 的真实名称与 ID 归属，并校验 Analytics Dataset、R2 名称。禁止嵌套环境和正式域名路由，预览 URL 关闭，AI 默认关闭。

## 云端自动部署

为两个 Worker 分别创建 Workers Builds 触发器，连接操作者仓库的已审阅分支。生产分支必须精确匹配；不要默认部署未审阅的 master 或其他分支。

每个触发器配置独立的部署变量：

- DEPLOY_CF_ACCOUNT_ID、DEPLOY_WORKER_NAME。
- DEPLOY_D1_DATABASE_NAME、DEPLOY_D1_DATABASE_ID。
- DEPLOY_KV_NAMESPACE_ID、DEPLOY_ANALYTICS_DATASET。
- DEPLOY_R2_BUCKET_NAME、DEPLOY_ENABLE_AI=false。
- NODE_VERSION 和 PNPM_VERSION 使用已验证的明确版本。

构建命令：`pnpm test:deploy && pnpm test:security && pnpm build`。

部署命令：`pnpm deploy:worker`。它生成私有配置、检查资源归属、应用迁移、发布 Worker，最后通过 script-settings API 恢复并验证日志查询参数脱敏。该后置步骤只修改 observability，不发送或覆盖绑定和运行密钥。

运行密钥 NUXT_SITE_TOKEN、NUXT_CF_API_TOKEN 继续由各实例的 Cloudflare 加密 Secret 管理，不放入公开构建变量。keep_vars 保留运行配置；发布后仍需验证登录、分析、备份、限流与数据隔离，不能只信配置。

部署凭据仅授予目标账号所需的 Workers 脚本编辑、构建配置编辑、D1 编辑、KV/R2 读取和账号设置读取权限；不授予区域路由、DNS、Tunnel、AI、容器等无关权限。账号级 Workers/D1 权限仍不是单 Worker 或单数据库 ACL，需要更强边界时另行设计独立账号。令牌只在 Cloudflare 构建服务和私有凭据存储中使用，按运维策略轮换。

## MCP 静态文件上传

静态文件上传需要短期会话 JWT。官方 MCP 出站代理若把账号 Authorization 追加到已有上传授权，会产生无效组合凭据并返回 401。排查依据为 [官方实现](https://github.com/cloudflare/mcp/blob/main/src/tools/execute.ts)。不能把所有 401 都解释为用户未登录。

只有明确批准的例外才可使用临时票据直传；限制为审阅清单、固定 Cloudflare 上传端点和短期票据。该例外不引入 CLI OAuth 或额外长期上传凭据，不自动扩大其他操作权限。

## 首次部署与验收

1. 复核账号和资源归属；中断后优先复用已存在的正确资源。
2. 确认 Analytics Engine 已启用。10089 表示需激活，不能删除统计绑定来绕过；遇到付费要求应停止。
3. 应用官方 D1 迁移并核对迁移追踪表，再发布匹配的 Worker 与存储绑定。
4. 仅启用获准的测试入口，保持正式域名与其他生产资源不变。
5. 登录 Links 完成初始化；独立验证全部功能、安全与隔离。
6. 配置分析读取凭据、定时备份、告警，执行隔离恢复与 Worker 回滚演练。
7. 观察定时任务实际执行，并验证 Git 推送确实触发云端部署。
8. P0 完整验收后才制作 Figma 统一管理中心原型，用户确认设计后再开发前端。

费用以 [Cloudflare 官方定价](https://developers.cloudflare.com/workers/platform/pricing/) 和账号实际用量为准，不能承诺零账单。
