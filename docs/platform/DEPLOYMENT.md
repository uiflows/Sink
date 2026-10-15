# Deployment procedure

Use the Cloudflare MCP connection explicitly selected by the operator. Keep account identity, resource identifiers and runtime deployment evidence in the private operator record. Local builds and Wrangler dry-runs do not constitute deployment.

## Baseline and safeguards

The pinned baseline is Sink v0.3.1 with Node 24+ and pnpm 11.11.0. Install from the lockfile and preserve the original dashboard.

The generated deployment policy allows only sink-brand and sink-marketing, requires DEPLOY_CF_ACCOUNT_ID, and validates instance-matched D1 names, Analytics datasets and R2 buckets. It rejects production routes and nested environments. AI is omitted unless explicitly enabled.

Supply resource IDs through deployment variables, never source-code constants. The original CLI workflow checks live D1 ID/name and KV ID/title before remote migrations. Only use a deployment channel the operator has authorized.

## MCP asset authentication

Worker assets require a short-lived upload-session JWT. An outbound proxy that appends account Authorization to an existing session header will produce an invalid combined credential. Inspect the official implementation when diagnosing this failure: https://github.com/cloudflare/mcp/blob/main/src/tools/execute.ts . Do not interpret every HTTP 401 as an unfinished user login.

A service-owner fix should preserve session authentication only for the narrowly scoped asset-upload endpoint while replacing Authorization for ordinary account requests. Do not change the remote MCP server or route around it without authorization.

Any separately approved direct-transfer exception must be limited to the reviewed manifest, the fixed Cloudflare asset endpoint and a short-lived session ticket. No CLI OAuth or long-lived token should be introduced by that exception. Resource creation, database migrations, secrets and publication remain on the selected MCP connection.

## Deployment sequence

1. Recheck account and resource ownership; reuse matching resources after interruptions.
2. Confirm Analytics Engine is enabled. Cloudflare error 10089 requires account activation; do not silently remove the binding. If MCP provides no activation interface, request the account owner’s action. Stop before any paid upgrade.
3. Register the asset manifest, upload exactly the returned hash buckets and obtain a completion ticket. Refresh expired tickets.
4. Apply all official D1 migrations with Wrangler-compatible d1_migrations tracking; verify results before publication.
5. Publish the reviewed bundle with independent encrypted secrets and ASSETS / DB / KV / ANALYTICS / R2 bindings. Keep NUXT_DATASET aligned with its binding. Never commit NUXT_SITE_TOKEN or NUXT_CF_API_TOKEN.
6. Enable only explicitly approved endpoints. Keep production routes and preview URLs disabled until authorized.
7. Initialize Links through the official authenticated flow and complete ACCEPTANCE.md checks.
8. Configure analysis-read credentials, daily backups, monitoring, restore validation and deployment automation. Test each independently; account activation does not prove token permissions.
9. Start the Figma prototype only after P0 acceptance. Implement the unified frontend only after design approval.

Public Analytics Engine pricing currently states it is not yet billed, but the account plan and actual dashboard must still be checked: https://developers.cloudflare.com/analytics/analytics-engine/pricing/ .
