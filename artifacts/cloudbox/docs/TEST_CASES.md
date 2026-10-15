# CloudBox Test Cases

All cases start as **NOT RUN**. Update actual results and status only after observing the test. AWS cases remain **NOT RUN** or **BLOCKED** until real AWS resources are available and tested. The Testing page provides a local editable checklist; this file is the written project record.

| ID | Scenario | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- |
| TC-01 | Homepage loading | Home page renders without console errors | — | NOT RUN |
| TC-02 | Navigation | All six page links open the correct page | — | NOT RUN |
| TC-03 | Responsive design | Content remains usable on phone, tablet, and desktop widths | — | NOT RUN |
| TC-04 | Theme toggle | Light/dark mode switches and preference persists after reload | — | NOT RUN |
| TC-05 | File selection | Selected filename, size, and MIME type are shown | — | NOT RUN |
| TC-06 | Empty file | Empty file encrypts and reconstructs as zero bytes | Automated crypto test: empty Blob round-trip returned 0 bytes | PASS |
| TC-07 | File smaller than 1 MiB | One block is produced for the default block size | Automated crypto test: 10-byte input produced one block and reconstructed exactly | PASS |
| TC-08 | File larger than 1 MiB | More than one block is produced at the default block size | Automated crypto test: 1 MiB + 29 bytes produced 2 blocks | PASS |
| TC-09 | Multiple-block file | All block indexes are present and reconstruction matches source bytes | Automated crypto test: 2-block byte-for-byte reconstruction matched | PASS |
| TC-10 | File size limit | A source over 100 MiB is rejected before file contents are read | Automated crypto test: oversized source rejected before `slice()` was called | PASS |
| TC-11 | Encryption | AES-256-GCM encryption completes with a fresh key and per-block IVs | Automated crypto test encrypted test files and validated package/key format | PASS |
| TC-12 | Package download | Versioned encrypted JSON package downloads and contains no key | — | NOT RUN |
| TC-13 | Key download | A separate valid key file downloads | — | NOT RUN |
| TC-14 | Successful decryption | Matching key authenticates every block | Automated crypto test: matching key decrypted all blocks and byte output matched | PASS |
| TC-15 | Incorrect key | Decryption fails with an authentication error | Automated crypto test: unrelated key was rejected by AES-GCM authentication | PASS |
| TC-16 | Tampered ciphertext | Modified encrypted data fails authentication | Automated crypto test: flipped ciphertext byte failed authentication | PASS |
| TC-17 | Invalid metadata | Unsupported version, size, or block metadata is rejected | Automated crypto test: inconsistent block size and 128-bit key were rejected | PASS |
| TC-18 | Missing blocks | Missing blocks are rejected before reconstruction | Automated crypto test: missing chunk was rejected during validation | PASS |
| TC-19 | Duplicate block indexes | Duplicate or out-of-order indexes are rejected | Automated crypto test: duplicate index was rejected during validation | PASS |
| TC-20 | File reconstruction | Output filename and byte size match validated metadata | Automated crypto test: reconstructed size and source bytes matched | PASS |
| TC-21 | CloudFront HTTPS access | Deployed distribution is reachable over HTTPS | — | NOT RUN |
| TC-22 | HTTP-to-HTTPS redirect | Distribution redirects viewer HTTP requests to HTTPS | — | NOT RUN |
| TC-23 | Private S3 bucket access | Direct public S3 object access is denied; configured CloudFront access succeeds | — | NOT RUN |
| TC-24 | Cloud object download | A real encrypted object downloads through the distribution | — | NOT RUN |
| TC-25 | CORS behavior | Browser fetch is allowed only from configured origins/methods | — | NOT RUN |
| TC-26 | Cloud download errors | 403, 404, network, and CORS failures are reported clearly; manual selection remains available | — | NOT RUN |

## Test record

- Tester: [Enter name]
- Date/time: [Enter date and time]
- Browser/version: [Enter]
- Device/OS: [Enter]
- Build revision: [Enter]
- Notes: [Enter observed setup and deviations]

### Status meanings

- **NOT RUN** — no observed execution has been recorded.
- **PASS** — the observed result matched the expected result.
- **FAIL** — the observed result did not match the expected result.
- **BLOCKED** — the test could not run because a required service, permission, or configuration was unavailable.

Do not mark AWS cases as PASS based only on the presence of deployment instructions or UI.
