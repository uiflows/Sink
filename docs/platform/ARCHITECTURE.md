# sink-platform 架构

状态：2026-10-15，完成环境核验和部署准备；两套业务存储已创建，Worker 尚未发布。

部署仓库为 https://github.com/uiflows/Sink，上游为 https://github.com/miantiao-me/Sink。基线固定为 v0.3.1 / bafa4e1f7e3ec034929e11e5542c4c3e116d69da。保留 Nuxt 后台、D1 权威存储、KV 读取缓存、Analytics Engine 和官方 R2 快照实现。

品牌实例使用 sink-brand，营销实例使用 sink-marketing。两实例分别绑定 DB、KV、ANALYTICS、R2，采用独立登录 Secret 和分析读取 Secret。AI 默认不绑定。代码和前端资源可复用，运行配置与业务数据必须分开。

实例隔离不等于账号隔离：两个实例与现有服务仍共享 Cloudflare 账号配额。官方分析 Token 的推荐权限为 Account Analytics Read，是账户级授权；独立 Token 不构成数据集级权限隔离。

新建统一管理中心、监测服务和 Hub 集成均未实施。P0 验收后先制作 Figma 原型，经用户确认再开发 P1 前端。Hub 后续只能通过受认证外围接口接入，不能修改其生产部署、模型路由和审核流程。
