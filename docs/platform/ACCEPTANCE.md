# 阶段验收

日期：2026-10-15。总体：未达到生产部署验收，不对外推广。

| 项目 | 真实结果 |
|---|---|
| GitHub 身份和仓库 | uiflows / uiflows/Sink；fork；master 基线 bafa4e1f7e3ec034929e11e5542c4c3e116d69da |
| Cloudflare 身份 | MCP mac02，alqjwdawlily@gmail.com，账号 5ffc6f2464e7a57957f4946837f45e03 |
| 现有生产资源 | 仅只读检查；本轮未修改网站、DNS、Tunnel 或 social-agent-hub |
| 两套 D1 / KV / R2 | 已经 MCP 实际创建，详见 RESOURCES.md |
| 双实例部署保护测试 | 本地已通过；正式数量和命令见交付报告 |
| pnpm build | 通过 |
| pnpm types:check | 通过；修复原版 Heatmap 的一处 unknown 类型标注 |
| 官方完整测试 | 未通过：本地运行器 cloudflare:test-internal 模块缺失，测试未执行 |
| 资产上传会话 | 两实例均成功，清单 176 个路径 |
| 资产文件上传 | MCP 内两种调用均返回 401 Unauthorized |
| Worker 发布、数据库迁移 | 尚未执行，不能提供已验收 URL |
| 登录、CRUD、301/302、二维码、移动端 | 线上未测 |
| 跨实例密钥/数据隔离 | 配置保护有测试；线上未测 |
| Analytics 点击记录与读取 | 未验收；SQL 权限 403，尚未配置读取 Secret |
| R2 快照、保留期、恢复演练 | Bucket 已建；功能未验收 |
| 告警实际送达 | 未配置、未测试 |
| Git 自动部署 | 尚未配置；无可用 build token，MCP 令牌管理权限不足 |
| 正式域名 | 未指定、未绑定 |
| Figma / 管理中心 / Hub | 未启动，等待 P0 验收；未修改 Hub |

不能把本地构建成功、资源创建成功或配置测试通过表述为生产部署成功。后续每次推进均追加独立运行环境的真实测试结果。
