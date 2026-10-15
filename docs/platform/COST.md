# 成本和配额

核查日期：2026-10-15。可见 Zone 套餐为 Free Website，但不代表 Workers Free。Workers 账号设置仅返回 standard 使用模型；订阅接口无权限，所以实际套餐及本月剩余额度仍待核实。本轮未购买或升级订阅。

公开套餐基准：

| 产品 | 免费额度或计费边界 |
|---|---|
| Workers Free | 账号共享 100,000 次动态请求/天，单次 CPU 10 ms |
| Workers Paid | 账号最低 5 美元/月，加超额用量；不是每 Worker 收 5 美元 |
| D1 Free | 每天读 500 万行、写 10 万行，总存储 5 GB |
| KV Free | 读 100,000 次/天，写 1,000 次/天；需结合其他应用共享用量 |
| Analytics Engine Free | 文档列写 100,000 点/天、读 10,000 次/天；当前价格页注明尚未开始计费，后续可能变化 |
| R2 Standard | 每月免费 10 GB-month、100 万 A 类操作、1,000 万 B 类操作；超额计费 |

两个 Sink、现有 social-agent-hub、Pages Functions 和其他产品的配额可能共享，不能按实例分别乘免费额度。新建空桶和少量测试不需要新增固定订阅，但也不能承诺账号月账单为 0。

备份容量可按“两实例每日快照平均大小之和 × 30”估算；实际还需计入已有 lingo 桶和其他 R2 使用。未测得真实流量或快照大小，不编造月账单。

AI 默认不绑定。Bulk Redirects 不在 P0 实施，等真实流量证明需要时再评估。

来源：
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/kv/platform/pricing/
- https://developers.cloudflare.com/analytics/analytics-engine/pricing/
- https://developers.cloudflare.com/r2/pricing/
