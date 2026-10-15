# Backup and restore procedure

Use separate private R2 buckets for the two instances. Configure 30-day expiry only for the backups/ prefix, preserving existing lifecycle rules. Read back the saved rule to verify it. Do not enable public bucket access.

The official daily schedule is 00:00 UTC. Enable NUXT_DISABLE_AUTO_BACKUP=false only after the authenticated Links initialization has completed and the R2 binding is valid. Verify an actual snapshot before marking backups operational.

Record success time, link count, snapshot key and failures privately. Alert on failures through a destination explicitly authorized by the user; validate real delivery.

Official JSON snapshots contain link records and may contain password material and complete target URLs. They exclude database schema, tombstones, migration history and raw Analytics events. They are not full database backups.

Use a separate environment for restore validation: apply the same schema, import the test snapshot, compare counts, slugs, targets and redirects. Never overwrite an existing business database during a drill.

D1 Time Travel differs from JSON snapshots. Check the current plan and recovery window before promising a rollback period.

References: https://docs.sink.cool/features/backups and https://developers.cloudflare.com/d1/reference/time-travel/ .
