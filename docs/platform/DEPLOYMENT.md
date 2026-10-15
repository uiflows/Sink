# 部署步骤与当前阻塞

## 执行边界

Cloudflare 环境检查和云端变更使用 Cloudflare MCP 的 mac02 连接。按用户纠正，停止浏览器与本机 Wrangler 登录/部署；本地 pnpm 和 Wrangler dry-run 仅用于构建与打包，不产生云端变更。

当前固定基线：Sink v0.3.1，Node 24+，pnpm 11.11.0，使用锁文件安装。Production branch 计划为 master，官方构建命令为 pnpm build，部署命令为 pnpm deploy:worker。

## 双实例保护

scripts/cloudflare-deploy-config.mjs 增加平台策略：

- DEPLOY_WORKER_NAME 仅允许 sink-brand 或 sink-marketing，不允许默认 sink。
- DEPLOY_CF_ACCOUNT_ID 必须明确指定已核实账号。
- D1 名称、Analytics Dataset、R2 Bucket 必须与实例匹配。
- 禁止配置生产路由或嵌套 Wrangler 环境。
- 未明确 DEPLOY_ENABLE_AI=true 时移除 AI 绑定。
- 原官方 CLI 部署流程在远程迁移前核对 D1 ID/名称和 KV ID/名称；这只是仓库中的可重复部署保护，本轮未使用 CLI 做云端部署。

资源 ID 通过 DEPLOY_D1_DATABASE_ID、DEPLOY_KV_NAMESPACE_ID 注入。其他变量包括 DEPLOY_D1_DATABASE_NAME、DEPLOY_ANALYTICS_DATASET、DEPLOY_R2_BUCKET_NAME。运行时 NUXT_DATASET 必须与 Dataset 一致。

NUXT_SITE_TOKEN 与 NUXT_CF_API_TOKEN 只能使用加密 Secret；禁止提交到 Git。每个实例使用不同值。NUXT_CF_ACCOUNT_ID 为普通配置。

## 当前状态

两套 D1、KV、R2 已通过 MCP 创建。已生成官方构建产物、Wrangler 本地 dry-run 产物和资产清单；两个实例的 assets-upload-session 均成功。

静态文件上传端点返回 401 Unauthorized：通过 MCP 内的 fetch 和 cloudflare.request 调用均失败；已确认上传票据仍在有效期内。具体原因尚未确认，不能断言是用户未登录。没有转用其他授权渠道，也没有发布缺少静态文件的 Worker。

MCP 的 Analytics SQL 读取返回 403；Token 权限列表返回 9109 Unauthorized；账户订阅读取返回 10000 Authentication error。Workers Builds 当前没有可用 build token。仍需通过受支持的 MCP 能力解决文件上传和相关权限。

下一步必须先复核资源清单，复用本项目已建资源；禁止再次创建同名副本。上传成功后才应用官方六次 D1 迁移、写入独立 Secrets、发布 Worker、初始化 Links 并执行线上验收。
