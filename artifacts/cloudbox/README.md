# CloudBox — Secure Storage and Content Delivery

CloudBox is an educational cloud-computing mini-project by Krushna Kedar (2026). It demonstrates configurable file segmentation, per-block AES-256-GCM encryption in a browser, separate key handling, reconstruction, and the intended S3 + CloudFront static-site architecture.

## Features

- Six static pages: Home, Architecture, Documentation, File Security, Team, and Testing.
- Browser-only encryption and decryption with Web Crypto; file contents and keys are not sent to a CloudBox server.
- Configurable 64 KiB–8 MiB blocks (1 MiB default), a 100 MiB source-file limit, and a separate downloadable key file.
- Local encrypted-package selection or HTTPS download from a user-provided CloudFront URL.
- Academic report, test-case checklist, and beginner AWS deployment guide.

The website is a **local demo** until deployed. AWS resources, actual cloud tests, and an authenticated upload API are not included.

## Technology

HTML5, CSS3, vanilla JavaScript, Vite as a development/static-build tool, browser Web Crypto API, AES-256-GCM, Amazon S3, CloudFront, Git, and GitHub.

## Project structure

```text
index.html
architecture.html
documentation.html
security.html
team.html
testing.html
css/style.css
js/app.js
js/diagrams.js
js/security.js
favicon.svg
docs/PROJECT_REPORT.md
docs/TEST_CASES.md
docs/AWS_DEPLOYMENT.md
tests/security.test.mjs
tests/site.test.mjs
```

## Run in Replit

Open the CloudBox web preview. Cryptography requires a secure context; Replit preview uses HTTPS. The code does not require an API server, database, API key, or paid service.

## Run locally

Use Node.js and pnpm from the workspace root:

```sh
pnpm --filter @workspace/cloudbox run dev
```

For a Windows PowerShell development server in an environment with Node.js and pnpm:

```powershell
pnpm --filter @workspace/cloudbox run dev
```

Vite prints the local address. `localhost` is considered a secure context by supported browsers.

To create the static output for S3:

```sh
pnpm --filter @workspace/cloudbox run build
```

The generated site is in `artifacts/cloudbox/dist/`. Upload the contents of that directory, not the source directory. See `docs/AWS_DEPLOYMENT.md`.

## Encryption demonstration

1. Open **File Security**, choose a file up to 100 MiB, and select a block size.
2. Select **Split & Encrypt**. CloudBox creates a new AES-256-GCM key and a unique 12-byte IV for each block.
3. Download the `.cloudbox.json` package and the separate key JSON. Store the key privately and separately.
4. To reconstruct, select the package and its matching key, then choose **Decrypt & Reconstruct**.
5. CloudBox validates the metadata, decrypts and authenticates each block, checks the reconstructed byte count, and offers the original file for download.

The key file is essential. Anyone holding both it and the package can decrypt the file. Do not publish or commit the key.

## Security scope and limitations

- This is an educational prototype, not a production key-management system.
- Browser-based processing can use several times the source file's memory. The input limit is 100 MiB; smaller files are better for memory-constrained devices.
- The key is exported in a separate plaintext key file. There is no password wrapping, recovery, access control, key rotation, or server-side key management.
- The application does not upload files. A user may upload an encrypted package manually in the AWS Console, but CloudBox does not provide an authenticated upload API.
- Remote package downloads require HTTPS and the CloudFront/S3 response must allow the page's origin through CORS. Manual package selection remains available.
- Replit is the development/preview environment. No AWS deployment is claimed until the owner completes and verifies it.

## Testing

Run the static-site and browser-independent crypto checks with:

```sh
pnpm --filter @workspace/cloudbox run test
```

To run only the crypto checks:

```sh
pnpm --filter @workspace/cloudbox run test:security
```

The interactive Testing page keeps a local editable checklist. AWS checks must remain **NOT RUN** or **BLOCKED** until the actual AWS resources are tested. See `docs/TEST_CASES.md` for the full record.

## GitHub

Repository placeholder: https://github.com/your-username/your-repository
