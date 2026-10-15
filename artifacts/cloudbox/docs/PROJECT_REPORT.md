# CloudBox — Secure Cloud Storage and Content Delivery

**Project category:** Cloud Computing Mini-Project  
**Student:** Krushna Kedar  
**Academic year:** 2026  
**Institution:** [Enter institution]  
**Department / class:** [Enter department and class]  
**Guide:** [Enter guide name]

## Abstract

CloudBox is an educational demonstration of client-side file segmentation and authenticated encryption alongside a static website delivery architecture using Amazon S3 and Amazon CloudFront. A selected file is split into configurable blocks; each non-empty block is encrypted independently with AES-256-GCM using a fresh 12-byte initialization vector. The encrypted blocks and descriptive metadata form a versioned JSON package. The raw encryption key is exported separately. A matching key can authenticate and decrypt the blocks, after which the browser reconstructs the original file and checks its size.

The static site documents how a private S3 bucket can serve website files through CloudFront Origin Access Control and HTTPS. This report describes the intended configuration, not a completed AWS deployment. Actual experimental results must be entered only after the corresponding tests are run.

## Introduction

Cloud storage makes files available from remote infrastructure, while content-delivery networks cache and distribute content closer to users. Storing objects in a cloud bucket does not by itself encrypt their contents end-to-end. CloudBox demonstrates a small client-side workflow in which data is authenticated and encrypted before a user chooses whether to store the package in cloud storage.

## Problem statement

Demonstrate basic file operations that segment a file into blocks, encrypt those blocks, download the encrypted result, and reconstruct the original file with a separate key. Also explain how a documentation website can be hosted from Amazon S3 and distributed securely with CloudFront.

## Objectives

1. Implement configurable file segmentation.
2. Encrypt blocks using the browser Web Crypto API and AES-256-GCM.
3. Keep the key separate from the package and provide a matching decryption flow.
4. Validate package structure, block order, sizes, keys, and authentication tags.
5. Explain private S3 origins, CloudFront distribution, Origin Access Control, HTTPS, and CORS.
6. Provide traceable tests and deployment guidance without claiming unverified outcomes.

## Technologies

| Technology | Use |
| --- | --- |
| HTML, CSS, vanilla JavaScript | Static pages, responsive interface, browser workflows |
| Web Crypto API | AES-GCM key generation, encryption, key import, and decryption |
| Amazon S3 | Intended object storage for static site and encrypted packages |
| Amazon CloudFront | Intended HTTPS delivery and CDN |
| Git and GitHub | Version control and source hosting |

## Architecture

**Website delivery (intended):** Browser → HTTPS → CloudFront → Origin Access Control → private S3 bucket → static site objects.

**File security (local demo):** Original file → block segmentation → AES-256-GCM → encrypted package + separate key file → optional manual S3 storage → optional CloudFront HTTPS download → authenticated decryption → reconstructed file.

The static site itself does not implement user accounts, authorization, or an authenticated upload API. Uploading an encrypted object through the AWS Console is a separate manual AWS operation.

## Algorithms

### Segmentation

For file size `N` bytes and configured block size `B`, the block count is `ceil(N / B)`. Blocks are contiguous slices in increasing order. A zero-byte file has zero data blocks and remains reconstructible as an empty file.

### Encryption

1. Generate a new extractable 256-bit AES-GCM key for the selected file.
2. Generate a cryptographically random 12-byte IV for each block.
3. Encrypt each block using AES-GCM with a 128-bit authentication tag.
4. Base64-encode the IV and ciphertext, and record the explicit block index.
5. Save format/version, algorithm, original filename, MIME type, original size, block size, block count, and chunks to a JSON package.
6. Export the raw key into a separate key JSON file.

The package does not contain the key. IVs are not secret, but they must be unique for each encryption under the same key.

### Decryption and reconstruction

Validate the versioned package and key before decryption. Check that expected block count equals `ceil(originalSize / blockSize)`, that indexes are contiguous and unique, and that IV and ciphertext lengths are valid. AES-GCM authentication failure indicates an incorrect key or modified block. Reassemble decrypted blocks in index order, then verify the final byte size against metadata.

## Implementation

The demonstration is a static browser application with no CloudBox backend or database. Source file processing takes place in the browser. Replit is used for development and preview; Amazon S3 and CloudFront are documented as the intended hosting target and are not represented as configured.

## Testing methodology

The automated crypto checks cover multi-block round trips, empty files, incorrect keys, modified ciphertext, malformed metadata, missing blocks, duplicate indexes, oversized input rejection, and block-size bounds. The browser checklist includes UI and cloud scenarios. Each test result must reflect an observed run; unverified AWS cases remain **NOT RUN** or **BLOCKED**.

## Results — editable after execution

- **Automated crypto checks:** 9 passed, 0 failed using `pnpm --filter @workspace/cloudbox run test:security`; included empty, small, multi-block, wrong-key, tamper, metadata, and input-limit cases.
- **Static site checks:** 7 passed, 0 failed using `pnpm --filter @workspace/cloudbox run test`; verified pages, local links, documentation anchors, security controls, team placeholders, test-case count, and local font assets.
- **Browser test date/version:** [Enter after testing the interactive website]
- **Browser and version:** [Enter observed browser]
- **Input file(s):** [Enter name, size, and block size]
- **Observed encrypted block count:** [Enter observed result]
- **Decrypted size / byte comparison:** [Enter actual observation]
- **Wrong-key and tamper tests:** [Enter actual observation]
- **AWS distribution / test results:** Not deployed / not run. [Replace only after real deployment and testing.]

Do not describe expected behavior as an experimental result.

## Limitations

- Browser memory usage grows beyond the source file size because data is encrypted, encoded, serialized, and reconstructed in memory. The default maximum source size is 100 MiB.
- The key file is not protected by a password or key-management service. Losing it prevents recovery; exposing it compromises confidentiality.
- The application has no authenticated upload API or multi-user access control.
- CloudFront JavaScript downloads may fail unless the response permits the site's origin through CORS.
- AWS deployment and AWS network tests are manual and are not pre-completed by the project.

## Future scope

Possible extensions include password-protected key wrapping, a server-side key-management integration, authenticated and audited uploads, resumable transfers, larger-file streaming with a carefully reviewed design, and automated AWS deployment checks. These are not implemented features.

## Conclusion

CloudBox demonstrates the relationship between file segmentation, AES-GCM authenticated encryption, separate key custody, and CDN-based delivery. It also makes the boundary between the local educational demo and a real AWS deployment explicit. The test record and report should be updated only with measured results.

## Official references

- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- `SubtleCrypto.encrypt()` and AES-GCM: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
- Amazon S3 User Guide: https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
- CloudFront Developer Guide: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html
