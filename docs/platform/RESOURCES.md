# Resource mapping template

Keep real account identifiers, resource IDs, login identities, credentials and deployment evidence in an access-controlled operator record outside Git. Populate deployment environment variables from that record; do not hardcode them in source.

| Resource | Brand instance | Marketing instance |
|---|---|---|
| Worker | sink-brand | sink-marketing |
| D1 name | sink-brand-db | sink-marketing-db |
| D1 ID | DEPLOY_D1_DATABASE_ID | DEPLOY_D1_DATABASE_ID |
| KV title | sink-brand-kv | sink-marketing-kv |
| KV ID | DEPLOY_KV_NAMESPACE_ID | DEPLOY_KV_NAMESPACE_ID |
| Analytics dataset | sink_brand | sink_marketing |
| R2 bucket | sink-brand-backup | sink-marketing-backup |
| Account ID | DEPLOY_CF_ACCOUNT_ID | DEPLOY_CF_ACCOUNT_ID |

Before mutation, verify existing resources and reuse the matching IDs. Never create duplicate resources merely because an earlier deployment was interrupted. Each instance needs independent encrypted secrets. Keep buckets private and production domains unbound until explicitly authorized.
