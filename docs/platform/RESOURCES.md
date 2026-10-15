# 真实资源映射

创建时间：2026-10-15；执行入口：Cloudflare MCP mac02；账号：5ffc6f2464e7a57957f4946837f45e03。

| 资源 | 品牌实例 | 营销实例 |
|---|---|---|
| Worker 名称 | sink-brand（尚未发布） | sink-marketing（尚未发布） |
| D1 名称 | sink-brand-db | sink-marketing-db |
| D1 ID | 86ec4d45-2273-4d8d-aa68-16d975eec6ba | aa805976-c675-423c-a2db-2e4737f9dca5 |
| KV 名称 | sink-brand-kv | sink-marketing-kv |
| KV ID | 962daa64679d4ad380434b1ec8bdf3b6 | 8a3102a32a344b87a17c1b874e2ef349 |
| Analytics Dataset | sink_brand（拟绑定，未验收） | sink_marketing（拟绑定，未验收） |
| R2 Bucket | sink-brand-backup | sink-marketing-backup |
| 登录 / 分析 Secret | 未配置 | 未配置 |
| 正式域名 | 待指定 | 待指定 |

D1 与 R2 地区为 APAC。D1 当前为新建空数据库，尚未应用迁移。Bucket 使用 Standard 存储；未开启公共域名或公共读取。

此表记录运维事实，不作为部署代码里的硬编码输入。实际 ID 通过部署变量提供。后续必须复用这些已创建资源，不能重复创建。
