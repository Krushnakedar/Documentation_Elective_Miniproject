(() => {
  const nodes = document.querySelectorAll('[data-diagram]');
  nodes.forEach(node => {
    const kind = node.dataset.diagram;
    if (kind === 'delivery') node.setAttribute('aria-label', 'Website delivery: Browser to HTTPS to CloudFront to Origin Access Control to private S3 bucket.');
    if (kind === 'file-security') node.setAttribute('aria-label', 'File protection: original file to blocks to AES-256-GCM encryption to package to storage or CDN, then decrypt and reconstruct.');
  });
})();
