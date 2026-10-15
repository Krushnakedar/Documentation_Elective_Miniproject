(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('[data-theme-toggle]');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav-links]');
  const toastRegion = document.querySelector('[data-toast-region]');
  if (nav) nav.id = 'primary-navigation';
  const storedTheme = localStorage.getItem('cloudbox-theme');
  root.dataset.theme = storedTheme === 'light' ? 'light' : 'dark';

  function syncThemeButton() {
    if (!themeButton) return;
    const light = root.dataset.theme === 'light';
    themeButton.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    themeButton.setAttribute('aria-pressed', String(light));
    themeButton.innerHTML = light
      ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  syncThemeButton();
  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('cloudbox-theme', root.dataset.theme);
    syncThemeButton();
  });
  menuButton?.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    nav?.classList.toggle('is-open', !expanded);
    menuButton.setAttribute('aria-label', expanded ? 'Open navigation menu' : 'Close navigation menu');
  });
  nav?.addEventListener('click', event => {
    if (event.target.closest('a')) {
      nav.classList.remove('is-open');
      menuButton?.setAttribute('aria-expanded', 'false');
      menuButton?.setAttribute('aria-label', 'Open navigation menu');
    }
  });

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.copy);
      if (!target) return;
      try {
        const clone = target.cloneNode(true);
        clone.querySelectorAll('.copy-button').forEach(control => control.remove());
        await navigator.clipboard.writeText(clone.innerText || target.value || '');
        button.textContent = 'Copied';
        toast('Copied to clipboard');
        window.setTimeout(() => { button.textContent = 'Copy'; }, 1600);
      } catch {
        toast('Clipboard access is unavailable. Select and copy the text manually.');
      }
    });
  });
  document.querySelectorAll('[data-toast]').forEach(button => {
    button.addEventListener('click', () => toast(button.dataset.toast));
  });
  const testCases = [
    { id: 'TC-01', scenario: 'Homepage loading', expected: 'Home page renders with the correct content and no critical browser errors.' },
    { id: 'TC-02', scenario: 'Navigation', expected: 'All six page links open the matching page and the active page is identified.' },
    { id: 'TC-03', scenario: 'Responsive design', expected: 'Navigation and content remain usable at phone, tablet, and desktop widths.' },
    { id: 'TC-04', scenario: 'Theme toggle', expected: 'Light and dark themes switch and the chosen theme persists after reload.' },
    { id: 'TC-05', scenario: 'File selection', expected: 'Filename, file size, MIME type, and estimated block count are shown.' },
    { id: 'TC-06', scenario: 'Empty files', expected: 'An empty file encrypts and reconstructs as a zero-byte file.' },
    { id: 'TC-07', scenario: 'Files smaller than 1 MiB', expected: 'A file smaller than the default block size produces one block.' },
    { id: 'TC-08', scenario: 'Files larger than 1 MiB', expected: 'A file larger than the default block size produces multiple blocks.' },
    { id: 'TC-09', scenario: 'Multiple-block files', expected: 'Every block is ordered and the reconstructed bytes match the source.' },
    { id: 'TC-10', scenario: 'File size limit', expected: 'Files over 100 MiB are rejected before reading their contents.' },
    { id: 'TC-11', scenario: 'Encryption', expected: 'AES-256-GCM uses a fresh key and unique 12-byte IV per encrypted block.' },
    { id: 'TC-12', scenario: 'Package download', expected: 'A versioned encrypted JSON package downloads without including the key.' },
    { id: 'TC-13', scenario: 'Key download', expected: 'The matching raw AES key downloads as a separate key file.' },
    { id: 'TC-14', scenario: 'Successful decryption', expected: 'The matching key authenticates and decrypts each block.' },
    { id: 'TC-15', scenario: 'Incorrect key', expected: 'A mismatched key fails authentication and no reconstructed file is offered.' },
    { id: 'TC-16', scenario: 'Tampered ciphertext', expected: 'Modified ciphertext fails AES-GCM authentication.' },
    { id: 'TC-17', scenario: 'Invalid metadata', expected: 'Malformed versions, sizes, indexes, encodings, or chunk metadata are rejected.' },
    { id: 'TC-18', scenario: 'Missing blocks', expected: 'A package with missing blocks is rejected before reconstruction.' },
    { id: 'TC-19', scenario: 'Duplicate block indexes', expected: 'Duplicate or out-of-order block indexes are rejected.' },
    { id: 'TC-20', scenario: 'File reconstruction', expected: 'The reconstructed filename and byte size match validated metadata.' },
    { id: 'TC-21', scenario: 'CloudFront HTTPS access', expected: 'A real configured distribution is reachable using HTTPS.' , aws: true },
    { id: 'TC-22', scenario: 'HTTP-to-HTTPS redirect', expected: 'A viewer HTTP request redirects to HTTPS at the real distribution.' , aws: true },
    { id: 'TC-23', scenario: 'Private S3 bucket access', expected: 'Anonymous S3 access is denied while authorized CloudFront origin reads work.' , aws: true },
    { id: 'TC-24', scenario: 'Cloud object download', expected: 'A real encrypted object downloads through the configured CloudFront URL.' , aws: true },
    { id: 'TC-25', scenario: 'CORS failures', expected: 'The browser allows configured origins and reports disallowed cross-origin access.' , aws: true },
    { id: 'TC-26', scenario: 'Cloud download errors', expected: '403, 404, network, and CORS failures are clear; manual package selection remains available.' , aws: true },
  ];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const testCaseRows = document.getElementById('testCaseRows');
  if (testCaseRows) {
    testCaseRows.innerHTML = testCases.map(test => `
      <tr data-test-row data-test-aws="${Boolean(test.aws)}" data-testid="row-test-${test.id}">
        <td class="mono" data-label="Test ID">${test.id}</td>
        <td data-label="Scenario"><strong>${escapeHtml(test.scenario)}</strong>${test.aws ? '<small class="test-note">AWS deployment required</small>' : ''}</td>
        <td data-label="Expected Result">${escapeHtml(test.expected)}</td>
        <td data-label="Actual Result"><input class="input test-actual" type="text" maxlength="240" data-actual-control="${test.id}" aria-label="Actual result for ${test.id}" placeholder="Enter observed result" data-testid="input-actual-${test.id}"></td>
        <td data-label="Status"><span class="test-result" data-test-state>NOT RUN</span><select class="select test-status-select" aria-label="Status for ${test.id}" data-test-control="${test.id}" data-testid="select-status-${test.id}"><option value="not-run">NOT RUN</option><option value="pass">PASS</option><option value="fail">FAIL</option><option value="blocked">BLOCKED</option></select></td>
      </tr>`).join('');
  }

  document.querySelectorAll('[data-test-control]').forEach(select => {
    const id = select.dataset.testControl;
    const statusKey = `cloudbox-test-status-${id}`;
    const actualKey = `cloudbox-test-actual-${id}`;
    const row = select.closest('[data-test-row]');
    const actualInput = row?.querySelector('[data-actual-control]');
    const label = row?.querySelector('[data-test-state]');
    const savedStatus = localStorage.getItem(statusKey);
    if (savedStatus && [...select.options].some(option => option.value === savedStatus)) select.value = savedStatus;
    if (actualInput) {
      actualInput.value = localStorage.getItem(actualKey) || '';
      actualInput.addEventListener('input', () => localStorage.setItem(actualKey, actualInput.value));
    }
    if (label) label.textContent = select.options[select.selectedIndex].textContent;
    select.addEventListener('change', () => {
      if (['pass', 'fail'].includes(select.value) && !actualInput?.value.trim()) {
        select.value = 'not-run';
        toast('Record the observed result before selecting PASS or FAIL.');
        return;
      }
      localStorage.setItem(statusKey, select.value);
      if (label) label.textContent = select.options[select.selectedIndex].textContent;
      toast(`${id} saved locally as ${select.options[select.selectedIndex].textContent}.`);
    });
  });
  document.querySelector('[data-reset-tests]')?.addEventListener('click', () => {
    document.querySelectorAll('[data-test-control]').forEach(select => {
      const id = select.dataset.testControl;
      select.value = 'not-run';
      localStorage.removeItem(`cloudbox-test-status-${id}`);
      const row = select.closest('[data-test-row]');
      const label = row?.querySelector('[data-test-state]');
      const actualInput = row?.querySelector('[data-actual-control]');
      if (label) label.textContent = 'NOT RUN';
      if (actualInput) {
        actualInput.value = '';
        localStorage.removeItem(`cloudbox-test-actual-${id}`);
      }
    });
    toast('All test results reset to NOT RUN on this device.');
  });

  function toast(message) {
    if (!toastRegion) return;
    const item = document.createElement('div');
    item.className = 'toast';
    item.setAttribute('role', 'status');
    item.textContent = message;
    toastRegion.append(item);
    window.setTimeout(() => item.remove(), 3400);
  }
})();
