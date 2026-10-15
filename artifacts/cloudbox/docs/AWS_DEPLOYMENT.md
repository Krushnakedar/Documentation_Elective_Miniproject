# Deploy CloudBox to Amazon S3 and CloudFront

This guide explains an intended deployment. It does not mean CloudBox is already hosted on AWS. Complete the steps in your own AWS account and record actual resource names and test results separately.

## 1. Build the static site

From the workspace root, run:

```sh
pnpm --filter @workspace/cloudbox run build
```

The generated static files are in `artifacts/cloudbox/dist/public/`. Check that the output contains all six HTML entry pages and that CSS, JavaScript, and the favicon use relative paths.

## 2. Create a private S3 bucket

1. In the Amazon S3 console, create a bucket in the desired Region. S3 bucket names are globally unique.
2. Keep **Block all public access** enabled. Do not add a public-read bucket policy.
3. Do not enable public website hosting for this design. CloudFront will use the bucket's regional REST origin and OAC.
4. Note the exact bucket name and Region for your own deployment record.

The private-origin pattern is described in AWS's CloudFront documentation: [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## 3. Upload website files

Upload the *contents* of `dist/public/` to the bucket root using the S3 console, or use the AWS CLI after installing and configuring it for your account:

```sh
aws s3 sync artifacts/cloudbox/dist/public/ s3://YOUR_BUCKET_NAME/
```

Replace `YOUR_BUCKET_NAME` with your own bucket. Never upload `.env` files, private keys, or the separate CloudBox encryption key. This command does not automatically remove older objects; review the bucket before cleaning up stale files.

## 4. Create CloudFront Origin Access Control

1. Create a CloudFront distribution and select the S3 bucket's **regional REST endpoint** as the origin. Do not use the S3 static website endpoint; OAC does not protect website endpoints in the same way.
2. Create or select an Origin Access Control for an S3 origin.
3. Use signed requests (recommended signing behavior) so CloudFront signs origin requests.
4. Keep the bucket private.
5. Set the distribution's **Default root object** to `index.html`.
6. Set the viewer protocol policy to **Redirect HTTP to HTTPS**.
7. Create the distribution and wait until AWS reports it as deployed.

AWS instructions: [Create an Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html#private-content-restricting-access-to-s3-oac).

### Bucket policy

If the console does not update the policy for you, grant only the CloudFront service principal read access, restricted to your distribution. Replace every placeholder with actual values; do not paste the placeholders as-is.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

Do not add a wildcard public principal. Check AWS's generated OAC policy for the exact distribution and bucket before saving it.

## 5. HTTPS and custom domains

CloudFront's default distribution hostname supports HTTPS. If using a custom domain, add it as an alternate domain name and configure a matching TLS certificate in AWS Certificate Manager in the Region CloudFront requires (currently `us-east-1`). Point the domain's DNS records to the CloudFront distribution. Follow the current AWS setup instructions for the account and domain.

AWS: [Require HTTPS for viewers](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https-viewers-to-cloudfront.html).

## 6. Verify the site

After the distribution is deployed:

1. Open its actual HTTPS distribution hostname.
2. Confirm the home page and each `.html` page load directly and on refresh.
3. Test the HTTP URL and confirm it redirects to HTTPS.
4. Confirm browser developer tools show no missing relative assets.
5. Request an S3 object URL directly and confirm public access is denied.
6. Open the same object through CloudFront and confirm it is available.
7. Test the security module over HTTPS. The browser Web Crypto API requires a secure context.
8. Record the exact date, browser, and observed result in `docs/TEST_CASES.md`.

AWS: [Default root object](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DefaultRootObject.html).

## 7. Upload an encrypted package (manual)

CloudBox does **not** implement an authenticated upload API. To demonstrate an AWS object download:

1. Encrypt a test file locally and download both the package and its separate key.
2. Store the key privately outside the public bucket; do not upload or commit it.
3. Upload only the encrypted package to a controlled S3 object path using the AWS Console or an authorized AWS CLI profile.
4. Access the package through the CloudFront distribution URL and paste that real HTTPS URL into CloudBox.
5. Select the separately stored key file in the browser and decrypt.

Anyone who obtains both package and key can decrypt the file. Encrypted packages can still reveal metadata such as their size and the filename stored in the package.

## 8. Configure CORS for browser downloads

CloudFront remote download is a cross-origin browser `fetch`. CORS must allow the web page's actual origin and `GET` (and any required preflight `OPTIONS`) for the package object. If the S3 bucket is the CloudFront origin, configure an appropriate S3 CORS rule and ensure CloudFront returns the required CORS headers, either by forwarding the needed origin headers or by using a suitable CloudFront response headers policy. Avoid `*` when a specific site origin is available.

Example starting point for S3 CORS; replace the allowed origin with the actual website origin:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://YOUR_CLOUDFRONT_DOMAIN"],
    "ExposeHeaders": ["Content-Length", "ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

This is an example policy, not a statement that CORS is configured. Test it in the browser. CloudBox reports CORS/network failures and keeps manual package selection available.

AWS references:

- [Amazon S3 CORS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
- [CloudFront response headers policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-response-headers-policies.html)

## 9. Cache invalidation after updates

CloudFront may continue to serve cached objects after an S3 upload. Either use versioned asset names or create an invalidation for the changed paths. A broad `/*` invalidation is simple but can have cost implications depending on usage and account terms.

AWS: [Create CloudFront invalidations](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html).

## 10. Troubleshooting

| Symptom | Checks |
| --- | --- |
| CloudFront 403 | Distribution is deployed; OAC is attached; bucket policy names the correct distribution; object path and case are correct; default root object is set |
| CloudFront 404 | Confirm the object was uploaded at the expected key and that direct `.html` page names match |
| Page loads without styles/scripts | Check uploaded file layout and relative URLs; inspect browser Network panel |
| Browser reports CORS error | Compare page origin, package URL, allowed CORS origin/methods, and CloudFront response headers; CORS is separate from S3 authorization |
| HTTPS or certificate issue | Check viewer protocol policy, DNS, certificate status/region, and alternate domain configuration |
| Old content appears | Check cache TTLs and invalidate the changed object paths |
| Web Crypto unavailable | Use HTTPS or `localhost` in a supported browser |

## 11. Costs and cleanup

S3 storage and requests, CloudFront data transfer and requests, DNS, certificates, logging, and invalidations may incur charges depending on current account terms and usage. Review current pricing and budgets before deploying.

- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/)
- [Amazon CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/)

When finished with a demonstration, disable or delete resources you no longer need. Empty the S3 bucket before deleting it, and check for outstanding distributions, logs, DNS records, and certificates. Follow AWS's current deletion process; deletion can be irreversible.
