# CloudBox

Static cloud-security learning portal and browser-based AES-256-GCM file encryption demo. AWS S3 and CloudFront are documented deployment targets, not assumed to be configured.

## Run & Operate

- `pnpm --filter @workspace/cloudbox run dev` — run the CloudBox static site in Replit
- `pnpm --filter @workspace/cloudbox run build` — create the static deployment files in `artifacts/cloudbox/dist/`
- `pnpm --filter @workspace/cloudbox run test` — run static-site and crypto tests
- `pnpm --filter @workspace/cloudbox run test:security` — run browser-independent crypto tests with Node's built-in test runner
- `pnpm --filter @workspace/cloudbox run typecheck` — typecheck the artifact scaffold
- CloudBox itself does not require a database, API, or environment secrets.

## Stack

- pnpm workspaces and Vite build tooling
- CloudBox runtime: static HTML, CSS, and vanilla JavaScript
- File encryption: browser Web Crypto API with AES-256-GCM
- Intended hosting: private Amazon S3 origin behind CloudFront OAC and HTTPS

## Where things live

- `artifacts/cloudbox/` — all six site pages, shared styles/scripts, security module, docs, and tests
- `artifacts/cloudbox/js/security.js` — package format and browser crypto workflow
- `artifacts/cloudbox/docs/` — academic report, test record, and AWS deployment guide
- `artifacts/cloudbox/tests/security.test.mjs` — Node-based crypto regression checks

## Architecture decisions

- Keep the delivered site static and browser-only; the unrelated API/database template is not a CloudBox dependency.
- The separate raw encryption key is not included in the encrypted package.
- Treat AWS deployment and test results as unverified until the owner has actually deployed and tested AWS resources.

## Product

- Six-page cloud security documentation portal.
- Local file segmentation, AES-256-GCM encryption, package/key downloads, and authenticated reconstruction.
- Optional HTTPS remote package download with explicit CORS/error handling; no upload API.

## User preferences

- Do not invent AWS resource IDs, deployment claims, cloud metrics, test results, or team-member identities.
- Keep the student/team content editable and preserve Krushna Kedar as project owner/coordinator.

## Gotchas

- Use HTTPS or localhost for Web Crypto.
- Browser processing has memory overhead; input limit is 100 MiB and the key must remain private.
- Do not upload the separate key file or commit it to Git.
- AWS tests remain NOT RUN or BLOCKED until real resources are available and tested.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
