# Production acceptance checklist

Record dated results and evidence in the operator’s private deployment record. Build success, resource creation and this checklist do not establish production readiness.

- Confirm the intended GitHub and Cloudflare identities, account and resource ownership.
- Verify existing unrelated applications, DNS and routes remain unchanged.
- Run deployment guards, production build, type checking and relevant lint.
- Run the official full test suite; startup failures are failures, not passed tests.
- Complete asset transfer and verify all official D1 migrations and encrypted bindings.
- Validate real login, API authentication, link CRUD, redirects, QR codes, mobile layouts and import/export.
- Verify each instance rejects the other instance’s credentials and cannot access its data.
- Validate Analytics event recording and authenticated reads independently.
- Validate backup creation, retention and restoration in an isolated environment.
- Send a real monitoring alert through an explicitly authorized destination.
- Verify automatic deployment and rollback before calling them operational.
- Obtain approval for production domains, paid plans and subsequent frontend design.

Never publish credentials, account email addresses or infrastructure identifiers as acceptance evidence in a public repository.
