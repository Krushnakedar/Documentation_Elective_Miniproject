export const CLOUD_BOX = Object.freeze({
  maxInputBytes: 100 * 1024 * 1024,
  minBlockBytes: 64 * 1024,
  maxBlockBytes: 8 * 1024 * 1024,
  defaultBlockBytes: 1024 * 1024,
  maxBlocks: 1600,
  maxPackageBytes: 145 * 1024 * 1024,
  format: "cloudbox-encrypted-package",
  version: 1,
  algorithm: "AES-256-GCM",
});

const GCM_TAG_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const MAX_NAME_LENGTH = 255;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function cryptoApi() {
  const api = globalThis.crypto;
  if (!api?.subtle || typeof api.getRandomValues !== "function") {
    throw new Error(
      "Web Crypto is unavailable. Open CloudBox in a supported browser over HTTPS or localhost.",
    );
  }
  return api;
}

function assertInputFile(file) {
  if (!file || typeof file.size !== "number" || typeof file.slice !== "function") {
    throw new Error("Choose a valid file before encrypting.");
  }
  if (file.size > CLOUD_BOX.maxInputBytes) {
    throw new Error("Files larger than 100 MiB are not supported by this browser demo.");
  }
  if (file.size < 0) throw new Error("The selected file has an invalid size.");
}

function validateBlockSize(value) {
  const size = Number(value);
  if (
    !Number.isSafeInteger(size) ||
    size < CLOUD_BOX.minBlockBytes ||
    size > CLOUD_BOX.maxBlockBytes
  ) {
    throw new Error("Block size must be between 64 KiB and 8 MiB.");
  }
  return size;
}

function cleanName(value) {
  const name = String(value || "reconstructed-file")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .replace(/^\.+$/, "");
  return (name || "reconstructed-file").slice(0, MAX_NAME_LENGTH);
}

function toBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const segmentSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < view.length; offset += segmentSize) {
    const end = Math.min(offset + segmentSize, view.length);
    let segment = "";
    for (let index = offset; index < end; index += 1) {
      segment += String.fromCharCode(view[index]);
    }
    binary += segment;
  }
  return btoa(binary);
}

function fromBase64(value, label, maxBytes) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > Math.ceil((maxBytes * 4) / 3) + 4 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error(`${label} is not valid Base64.`);
  }

  let binary;
  try {
    binary = atob(value);
  } catch {
    throw new Error(`${label} is not valid Base64.`);
  }
  if (binary.length > maxBytes) throw new Error(`${label} is too large.`);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
}

function reportProgress(callback, progress, status) {
  if (typeof callback === "function") callback(progress, status);
}

export async function encryptFile(file, blockSizeValue, onProgress) {
  assertInputFile(file);
  const blockSize = validateBlockSize(blockSizeValue);
  const chunkCount = Math.ceil(file.size / blockSize);
  if (chunkCount > CLOUD_BOX.maxBlocks) {
    throw new Error("The selected block size would create too many blocks.");
  }

  const crypto = cryptoApi();
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const chunks = [];

  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * blockSize;
    const end = Math.min(start + blockSize, file.size);
    const plaintext = await file.slice(start, end).arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      plaintext,
    );
    chunks.push({ index, iv: toBase64(iv), ciphertext: toBase64(ciphertext) });
    reportProgress(
      onProgress,
      Math.round(((index + 1) / Math.max(chunkCount, 1)) * 100),
      `Encrypted block ${index + 1} of ${chunkCount}.`,
    );
  }

  if (chunkCount === 0) reportProgress(onProgress, 100, "Prepared the empty file.");

  const packageData = {
    format: CLOUD_BOX.format,
    version: CLOUD_BOX.version,
    algorithm: CLOUD_BOX.algorithm,
    originalName: cleanName(file.name),
    originalType:
      typeof file.type === "string" && file.type.length <= 255 ? file.type : "",
    originalSize: file.size,
    blockSize,
    blockCount: chunkCount,
    chunks,
  };
  const packageBlob = new Blob([JSON.stringify(packageData)], {
    type: "application/vnd.cloudbox.package+json",
  });
  if (packageBlob.size > CLOUD_BOX.maxPackageBytes) {
    throw new Error("The encrypted package exceeds the supported package size.");
  }

  const keyData = {
    format: "cloudbox-key",
    version: CLOUD_BOX.version,
    algorithm: CLOUD_BOX.algorithm,
    key: toBase64(rawKey),
  };
  const keyBlob = new Blob([JSON.stringify(keyData, null, 2)], {
    type: "application/vnd.cloudbox.key+json",
  });
  return { packageBlob, keyBlob, packageData };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePackage(data) {
  if (!isRecord(data)) throw new Error("The package must contain a JSON object.");
  if (
    data.format !== CLOUD_BOX.format ||
    data.version !== CLOUD_BOX.version ||
    data.algorithm !== CLOUD_BOX.algorithm
  ) {
    throw new Error("Unsupported CloudBox package format, version, or algorithm.");
  }
  if (
    typeof data.originalName !== "string" ||
    data.originalName.length === 0 ||
    data.originalName.length > MAX_NAME_LENGTH ||
    data.originalName.includes("/") ||
    data.originalName.includes("\\")
  ) {
    throw new Error("The package has invalid original filename metadata.");
  }
  if (
    !Number.isSafeInteger(data.originalSize) ||
    data.originalSize < 0 ||
    data.originalSize > CLOUD_BOX.maxInputBytes
  ) {
    throw new Error("The package has an invalid or unsupported original file size.");
  }
  const blockSize = validateBlockSize(data.blockSize);
  const expectedCount = Math.ceil(data.originalSize / blockSize);
  if (
    !Number.isSafeInteger(data.blockCount) ||
    data.blockCount < 0 ||
    data.blockCount > CLOUD_BOX.maxBlocks ||
    data.blockCount !== expectedCount
  ) {
    throw new Error("The package block count does not match its file size metadata.");
  }
  if (!Array.isArray(data.chunks) || data.chunks.length !== data.blockCount) {
    throw new Error("The package has missing or extra encrypted blocks.");
  }
  if (
    data.originalType !== undefined &&
    (typeof data.originalType !== "string" || data.originalType.length > 255)
  ) {
    throw new Error("The package has invalid MIME type metadata.");
  }

  const seenIvs = new Set();
  for (let index = 0; index < data.chunks.length; index += 1) {
    const chunk = data.chunks[index];
    if (!isRecord(chunk) || chunk.index !== index) {
      throw new Error("The package contains a duplicate, missing, or out-of-order block index.");
    }
    const iv = fromBase64(chunk.iv, `Block ${index + 1} IV`, IV_BYTES);
    if (iv.length !== IV_BYTES) throw new Error(`Block ${index + 1} has an invalid IV length.`);
    const ivKey = toBase64(iv);
    if (seenIvs.has(ivKey)) throw new Error("The package reuses an encryption IV.");
    seenIvs.add(ivKey);

    const plaintextSize = Math.min(
      blockSize,
      Math.max(data.originalSize - index * blockSize, 0),
    );
    const ciphertext = fromBase64(
      chunk.ciphertext,
      `Block ${index + 1} ciphertext`,
      blockSize + GCM_TAG_BYTES,
    );
    if (ciphertext.length !== plaintextSize + GCM_TAG_BYTES) {
      throw new Error(`Block ${index + 1} has an inconsistent encrypted size.`);
    }
  }
  return data;
}

async function readJsonBlob(blob, label, maxBytes) {
  if (!blob || typeof blob.size !== "number") throw new Error(`Choose a ${label} file.`);
  if (blob.size === 0 || blob.size > maxBytes) {
    throw new Error(`The ${label} file is empty or exceeds the supported size.`);
  }
  let text;
  try {
    text = await blob.text();
    return JSON.parse(text);
  } catch {
    throw new Error(`The ${label} file is not valid JSON.`);
  }
}

async function importKey(keyInput) {
  const data = await readJsonBlob(keyInput, "key", 4096);
  if (
    !isRecord(data) ||
    data.format !== "cloudbox-key" ||
    data.version !== CLOUD_BOX.version ||
    data.algorithm !== CLOUD_BOX.algorithm
  ) {
    throw new Error("The key file is not a supported CloudBox key.");
  }
  const rawKey = fromBase64(data.key, "Encryption key", KEY_BYTES);
  if (rawKey.length !== KEY_BYTES) {
    throw new Error("The encryption key must be exactly 256 bits (32 bytes).");
  }
  return cryptoApi().subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

export async function decryptPackage(packageInput, keyInput, onProgress) {
  if (!packageInput || typeof packageInput.size !== "number") {
    throw new Error("Choose an encrypted package file or download one from CloudFront.");
  }
  if (packageInput.size === 0 || packageInput.size > CLOUD_BOX.maxPackageBytes) {
    throw new Error("The package is empty or exceeds the supported 145 MiB limit.");
  }
  const packageData = validatePackage(
    await readJsonBlob(packageInput, "encrypted package", CLOUD_BOX.maxPackageBytes),
  );
  const key = await importKey(keyInput);
  const crypto = cryptoApi();
  const outputParts = [];
  let totalBytes = 0;

  for (let index = 0; index < packageData.chunks.length; index += 1) {
    const chunk = packageData.chunks[index];
    const iv = fromBase64(chunk.iv, `Block ${index + 1} IV`, IV_BYTES);
    const ciphertext = fromBase64(
      chunk.ciphertext,
      `Block ${index + 1} ciphertext`,
      packageData.blockSize + GCM_TAG_BYTES,
    );
    let plaintext;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        ciphertext,
      );
    } catch {
      throw new Error(
        `Block ${index + 1} failed authentication. The key is incorrect or the package was modified.`,
      );
    }
    totalBytes += plaintext.byteLength;
    if (totalBytes > packageData.originalSize) {
      throw new Error("Decrypted blocks exceed the original file size.");
    }
    outputParts.push(plaintext);
    reportProgress(
      onProgress,
      Math.round(((index + 1) / Math.max(packageData.blockCount, 1)) * 100),
      `Verified block ${index + 1} of ${packageData.blockCount}.`,
    );
  }

  if (packageData.blockCount === 0) reportProgress(onProgress, 100, "Verified the empty file.");
  if (totalBytes !== packageData.originalSize) {
    throw new Error("Reconstructed file size does not match the package metadata.");
  }
  const blob = new Blob(outputParts, {
    type: packageData.originalType || "application/octet-stream",
  });
  if (blob.size !== packageData.originalSize) {
    throw new Error("Reconstructed file size could not be verified.");
  }
  return {
    blob,
    fileName: cleanName(packageData.originalName),
    fileSize: blob.size,
    mimeType: blob.type,
  };
}

async function readBoundedResponse(response, maximumBytes) {
  if (!response.body?.getReader) {
    const blob = await response.blob();
    if (blob.size > maximumBytes) throw new Error("The downloaded package exceeds the supported size limit.");
    return blob;
  }
  const reader = response.body.getReader();
  const parts = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("The downloaded package exceeds the supported 145 MiB limit.");
      }
      parts.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  return new Blob(parts, {
    type: response.headers.get("content-type") || "application/octet-stream",
  });
}

function displayBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function setProgress(id, value) {
  const progress = document.getElementById(id);
  if (!progress) return;
  progress.value = value;
  progress.setAttribute("aria-valuenow", String(value));
}

function setProgressLabel(id, text) {
  setText(id, text);
}

function setBusy(form, busy) {
  if (!form) return;
  for (const control of form.querySelectorAll("button, input, select, textarea")) {
    if (busy) {
      if (control.dataset.cloudboxDisabledBeforeBusy === undefined) {
        control.dataset.cloudboxDisabledBeforeBusy = String(control.disabled);
      }
      control.disabled = true;
      control.setAttribute("aria-disabled", "true");
    } else {
      const previous = control.dataset.cloudboxDisabledBeforeBusy;
      if (previous !== undefined) {
        control.disabled = previous === "true";
        delete control.dataset.cloudboxDisabledBeforeBusy;
      }
      if (!control.disabled) control.removeAttribute("aria-disabled");
    }
  }
}

function setErrorStatus(id, message) {
  const status = document.getElementById(id);
  if (!status) return;
  status.textContent = message;
  status.setAttribute("role", "alert");
  status.setAttribute("aria-live", "assertive");
  status.dataset.state = "error";
}

function setInfoStatus(id, message) {
  const status = document.getElementById(id);
  if (!status) return;
  status.textContent = message;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.dataset.state = "ready";
}

function revokeLater(url) {
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = cleanName(name);
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  revokeLater(url);
}

function packageName(fileName) {
  const cleaned = cleanName(fileName);
  return `${cleaned}.cloudbox.json`;
}

function bindSecurityUi() {
  if (!document.getElementById("encryptForm") && !document.getElementById("decryptForm")) {
    return;
  }
  const sourceInput = document.getElementById("sourceFile");
  const blockSizeInput = document.getElementById("blockSize");
  const encryptForm = document.getElementById("encryptForm");
  const decryptForm = document.getElementById("decryptForm");
  const packageInput = document.getElementById("packageFile");
  const keyInput = document.getElementById("keyFile");
  const encryptButton = document.getElementById("encryptButton");
  const decryptButton = document.getElementById("decryptButton");
  const packageDownload = document.getElementById("packageDownload");
  const keyDownload = document.getElementById("keyDownload");
  const outputDownload = document.getElementById("outputDownload");
  const fetchButton = document.getElementById("fetchPackageButton");
  const urlInput = document.getElementById("cloudfrontUrl");

  let encryptedResult = null;
  let selectedPackage = null;
  let reconstructed = null;
  let busy = false;
  let cryptoReady = window.isSecureContext !== false;

  if (encryptButton) encryptButton.type = "submit";
  if (decryptButton) decryptButton.type = "submit";
  if (fetchButton) fetchButton.type = "button";
  if (packageDownload) packageDownload.type = "button";
  if (keyDownload) keyDownload.type = "button";
  if (outputDownload) outputDownload.type = "button";

  if (blockSizeInput && !blockSizeInput.value) {
    blockSizeInput.value = String(CLOUD_BOX.defaultBlockBytes);
  }
  const hasSafeHttpsUrl = () => {
    try {
      const parsed = new URL(urlInput?.value.trim() || "");
      return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  };
  const updateFetchButton = () => {
    if (fetchButton && !busy) fetchButton.disabled = !hasSafeHttpsUrl();
  };
  if (packageDownload) packageDownload.hidden = true;
  if (keyDownload) keyDownload.hidden = true;
  if (outputDownload) outputDownload.hidden = true;
  if (encryptButton) encryptButton.disabled = !cryptoReady || !sourceInput?.files?.[0];
  if (decryptButton) decryptButton.disabled = true;
  if (fetchButton) fetchButton.disabled = true;

  const refreshDecryptButton = () => {
    if (decryptButton && !busy) {
      decryptButton.disabled = !(
        cryptoReady &&
        selectedPackage &&
        keyInput?.files?.[0]
      );
    }
  };

  const updateEstimate = () => {
    const file = sourceInput?.files?.[0];
    if (!file) {
      setText("blockCount", "—");
      return;
    }
    const size = Number(blockSizeInput?.value || CLOUD_BOX.defaultBlockBytes);
    if (!Number.isSafeInteger(size) || size <= 0) {
      setText("blockCount", "Invalid block size");
      return;
    }
    const count = Math.ceil(file.size / size);
    const unit = size % (1024 * 1024) === 0
      ? `${size / (1024 * 1024)} MiB`
      : `${Math.round(size / 1024)} KiB`;
    setText(
      "blockCount",
      `${cleanName(file.name)} · ${displayBytes(file.size)} · ${file.type || "unknown MIME type"} · estimated ${count.toLocaleString()} ${count === 1 ? "block" : "blocks"} at ${unit} each.`,
    );
  };

  sourceInput?.addEventListener("change", () => {
    encryptedResult = null;
    if (packageDownload) packageDownload.hidden = true;
    if (keyDownload) keyDownload.hidden = true;
    updateEstimate();
    const file = sourceInput.files?.[0];
    if (file && file.size > CLOUD_BOX.maxInputBytes) {
      setErrorStatus("encryptStatus", "Files larger than 100 MiB are not supported.");
      if (encryptButton) encryptButton.disabled = true;
    } else {
      if (encryptButton && !busy) encryptButton.disabled = !cryptoReady || !file;
      if (file && cryptoReady) setInfoStatus("encryptStatus", "File selected. Ready to encrypt.");
      if (file && !cryptoReady) {
        setErrorStatus("encryptStatus", "Web Crypto requires a supported browser in a secure context.");
      }
    }
  });
  blockSizeInput?.addEventListener("input", updateEstimate);
  blockSizeInput?.addEventListener("change", updateEstimate);
  urlInput?.addEventListener("input", updateFetchButton);
  urlInput?.addEventListener("change", updateFetchButton);

  encryptForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const file = sourceInput?.files?.[0];
    if (!file) {
      setErrorStatus("encryptStatus", "Choose a source file first.");
      return;
    }
    if (file.size > CLOUD_BOX.maxInputBytes) {
      setErrorStatus("encryptStatus", "Files larger than 100 MiB are not supported.");
      return;
    }

    busy = true;
    setBusy(encryptForm, true);
    if (packageDownload) packageDownload.hidden = true;
    if (keyDownload) keyDownload.hidden = true;
    setProgress("encryptProgress", 0);
    setProgressLabel("text-encrypt-progress", "Starting encryption");
    setInfoStatus("encryptStatus", "Generating a fresh AES-256-GCM key…");
    try {
      encryptedResult = await encryptFile(file, blockSizeInput?.value, (progress, status) => {
        setProgress("encryptProgress", progress);
        setProgressLabel("text-encrypt-progress", `${progress}% · ${status}`);
        setInfoStatus("encryptStatus", status);
      });
      if (packageDownload) packageDownload.hidden = false;
      if (keyDownload) keyDownload.hidden = false;
      setProgressLabel("text-encrypt-progress", "Complete");
      const status = `Encryption complete. ${encryptedResult.packageData.blockCount} block(s) authenticated and ready.`;
      setInfoStatus("encryptStatus", status);
    } catch (error) {
      encryptedResult = null;
      setProgressLabel("text-encrypt-progress", "Failed");
      setErrorStatus(
        "encryptStatus",
        error instanceof Error ? error.message : "Encryption failed.",
      );
    } finally {
      busy = false;
      setBusy(encryptForm, false);
      if (encryptButton) {
        encryptButton.disabled =
          !cryptoReady ||
          !sourceInput?.files?.[0] ||
          sourceInput.files[0].size > CLOUD_BOX.maxInputBytes;
      }
    }
  });

  packageDownload?.addEventListener("click", (event) => {
    event.preventDefault();
    if (encryptedResult) {
      const fileName = sourceInput?.files?.[0]?.name || "file";
      downloadBlob(encryptedResult.packageBlob, packageName(fileName));
    }
  });
  keyDownload?.addEventListener("click", (event) => {
    event.preventDefault();
    if (encryptedResult) {
      downloadBlob(encryptedResult.keyBlob, "cloudbox-encryption-key.json");
    }
  });

  packageInput?.addEventListener("change", () => {
    selectedPackage = packageInput.files?.[0] || null;
    reconstructed = null;
    if (outputDownload) outputDownload.hidden = true;
    if (selectedPackage) {
      setInfoStatus(
        "decryptStatus",
        `Package selected: ${cleanName(selectedPackage.name)} (${displayBytes(selectedPackage.size)}).`,
      );
    }
    refreshDecryptButton();
  });
  keyInput?.addEventListener("change", () => {
    const keyFile = keyInput.files?.[0];
    reconstructed = null;
    if (outputDownload) outputDownload.hidden = true;
    if (keyFile) {
      setInfoStatus("decryptStatus", "Key file selected. Keep it private.");
    }
    refreshDecryptButton();
  });

  fetchButton?.addEventListener("click", async () => {
    if (busy) return;
    const suppliedUrl = urlInput?.value.trim() || "";
    let parsedUrl;
    try {
      parsedUrl = new URL(suppliedUrl);
    } catch {
      setErrorStatus("decryptStatus", "Enter a valid HTTPS CloudFront object URL.");
      return;
    }
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      setErrorStatus("decryptStatus", "Remote package downloads require an HTTPS URL without credentials.");
      return;
    }

    busy = true;
    if (decryptForm) setBusy(decryptForm, true);
    fetchButton.disabled = true;
    reconstructed = null;
    if (outputDownload) outputDownload.hidden = true;
    setProgressLabel("text-decrypt-progress", "Downloading package");
    setInfoStatus("decryptStatus", "Requesting the exact URL provided…");
    try {
      const response = await fetch(suppliedUrl, { method: "GET", mode: "cors" });
      if (response.url && new URL(response.url).protocol !== "https:") {
        throw new Error("The package URL redirected away from HTTPS; refusing the download.");
      }
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("CloudFront returned HTTP 403. Check object permissions and the distribution origin access policy.");
        }
        if (response.status === 404) {
          throw new Error("CloudFront returned HTTP 404. Check the object path and distribution state.");
        }
        throw new Error(`CloudFront returned HTTP ${response.status}.`);
      }
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > CLOUD_BOX.maxPackageBytes) {
        throw new Error("The remote package exceeds the supported 145 MiB limit.");
      }
      const blob = await readBoundedResponse(response, CLOUD_BOX.maxPackageBytes);
      if (blob.size === 0 || blob.size > CLOUD_BOX.maxPackageBytes) {
        throw new Error("The downloaded package is empty or exceeds the supported 145 MiB limit.");
      }
      selectedPackage = blob;
      if (packageInput) packageInput.value = "";
      setProgressLabel("text-decrypt-progress", "Package downloaded");
      setInfoStatus(
        "decryptStatus",
        `Package downloaded over HTTPS (${displayBytes(blob.size)}). Select its separate key file to decrypt.`,
      );
    } catch (error) {
      const message =
        error instanceof TypeError
          ? "The browser could not read the remote package. Check the URL, network, and CloudFront CORS headers. Manual package selection is still available."
          : error instanceof Error
            ? `${error.message} Manual package selection is still available.`
            : "CloudFront download failed. Manual package selection is still available.";
      setErrorStatus("decryptStatus", message);
      setProgressLabel("text-decrypt-progress", "Download failed");
    } finally {
      busy = false;
      if (decryptForm) setBusy(decryptForm, false);
      updateFetchButton();
      refreshDecryptButton();
    }
  });

  decryptForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!selectedPackage) {
      setErrorStatus("decryptStatus", "Select an encrypted package or download one from CloudFront.");
      return;
    }
    const keyFile = keyInput?.files?.[0];
    if (!keyFile) {
      setErrorStatus("decryptStatus", "Select the separate CloudBox key file.");
      return;
    }
    busy = true;
    setBusy(decryptForm, true);
    if (fetchButton) fetchButton.disabled = true;
    reconstructed = null;
    if (outputDownload) outputDownload.hidden = true;
    setProgress("decryptProgress", 0);
    setProgressLabel("text-decrypt-progress", "Starting reconstruction");
    setInfoStatus("decryptStatus", "Validating package metadata and importing the key…");
    try {
      reconstructed = await decryptPackage(
        selectedPackage,
        keyFile,
        (progress, status) => {
          setProgress("decryptProgress", progress);
          setProgressLabel("text-decrypt-progress", `${progress}% · ${status}`);
          setInfoStatus("decryptStatus", status);
        },
      );
      if (outputDownload) outputDownload.hidden = false;
      setProgressLabel("text-decrypt-progress", "Complete");
      const meta = `${reconstructed.fileName} · ${displayBytes(reconstructed.fileSize)} · ${reconstructed.mimeType}`;
      setText("reconstructedMeta", meta);
      setInfoStatus("decryptStatus", `Decryption and size verification complete. ${meta}`);
    } catch (error) {
      reconstructed = null;
      if (outputDownload) outputDownload.hidden = true;
      setProgressLabel("text-decrypt-progress", "Failed");
      setErrorStatus(
        "decryptStatus",
        error instanceof Error ? error.message : "Decryption failed.",
      );
    } finally {
      busy = false;
      setBusy(decryptForm, false);
      updateFetchButton();
      refreshDecryptButton();
    }
  });

  outputDownload?.addEventListener("click", (event) => {
    event.preventDefault();
    if (reconstructed) downloadBlob(reconstructed.blob, reconstructed.fileName);
  });

  if (sourceInput?.files?.[0]) updateEstimate();
  if (window.isSecureContext === false) {
    cryptoReady = false;
    setErrorStatus(
      "encryptStatus",
      "Secure context required: use HTTPS or localhost for browser cryptography.",
    );
    if (encryptButton) encryptButton.disabled = true;
  }
  try {
    cryptoApi();
  } catch (error) {
    cryptoReady = false;
    setErrorStatus(
      "encryptStatus",
      error instanceof Error ? error.message : "Web Crypto is unavailable.",
    );
    if (encryptButton) encryptButton.disabled = true;
    if (decryptButton) decryptButton.disabled = true;
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSecurityUi, { once: true });
  } else {
    bindSecurityUi();
  }
}
