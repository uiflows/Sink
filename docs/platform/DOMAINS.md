# 域名与路由

2026-10-15 通过 mac02 Cloudflare MCP 核实可见 Zone：aweb3.cc、nsyuop.me、panmjo.tech、us4v.com，均为 active。DNS 记录数依次为 14、7、27、16。

这些域名都有现有记录，不能因为可见就视为可用于 Sink。现有 hub.nsyuop.me 路由对应 social-agent-hub，列为保护对象。

品牌短域名 A 与营销短域名 B 均待用户指定。本轮没有创建、修改或删除 DNS、Zone、Worker Routes、Custom Domains 或 Tunnel。

未来测试地址计划为 sink-brand.alqjwdawlily.workers.dev 与 sink-marketing.alqjwdawlily.workers.dev；目前 Worker 未发布，这两个地址不是已验收的可用入口。

正式域名确认后，资产记录须包含域名、品牌、项目、用途、Zone、注册商、到期时间、Worker、创建时间、检查时间、健康状态和平台限制记录。当前 API 未能核实到期日，不从 Zone 创建日期推算。
