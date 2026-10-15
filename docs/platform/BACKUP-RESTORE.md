# 备份与恢复

已通过 MCP 创建两个独立私有备份桶：sink-brand-backup、sink-marketing-backup。尚未写入 Sink 备份、设置生命周期或完成恢复演练。

后续启用官方每日快照：Wrangler cron 为 00:00 UTC，即新加坡时间 08:00。运行时 NUXT_DISABLE_AUTO_BACKUP=false，绑定 R2，且必须先完成 Links 首次初始化。

初期保留 30 天，仅对 backups/ 前缀设置生命周期。Bucket 不启用公共读取。分别记录最近成功时间、链接数量、快照键和失败原因；失败必须形成事件并通过已验证渠道告警。

官方 R2 JSON 快照仅包含链接记录，可能包含密码材料与完整目标 URL；不包含数据库结构、删除标记、迁移历史或 Analytics 原始数据，不能当作完整数据库备份。

D1 Time Travel 官方窗口：Workers Free 为 7 天，Paid 为 30 天；当前实际 Workers 套餐未确认，不能承诺 30 天数据库回滚。

恢复演练须使用独立环境：应用相同 schema，导入本轮测试快照，比对数量、短码、目标和跳转，然后记录结果。不得向已有业务数据库覆盖导入。尚未进行该演练。

来源：https://docs.sink.cool/features/backups 与 https://developers.cloudflare.com/d1/reference/time-travel/
