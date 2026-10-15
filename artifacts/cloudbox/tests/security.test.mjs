import test from "node:test";
import assert from "node:assert/strict";
import { decryptPackage, encryptFile, CLOUD_BOX } from "../js/security.js";

function makeFile(bytes, name = "sample.txt", type = "text/plain") {
  const blob = new Blob([bytes], { type });
  Object.defineProperty(blob, "name", { value: name });
  return blob;
}

async function jsonBlob(value) {
  return new Blob([JSON.stringify(value)], { type: "application/json" });
}

async function encryptSample(bytes, blockSize = CLOUD_BOX.minBlockBytes) {
  const file = makeFile(bytes);
  const encrypted = await encryptFile(file, blockSize);
  return { file, ...encrypted };
}

test("encrypts multiple blocks and reconstructs the exact bytes", async () => {
  const input = Uint8Array.from(
    { length: CLOUD_BOX.defaultBlockBytes + 29 },
    (_, i) => i % 251,
  );
  const { file, packageBlob, keyBlob, packageData } = await encryptSample(
    input,
    CLOUD_BOX.defaultBlockBytes,
  );
  assert.equal(packageData.blockCount, 2);
  assert.equal("key" in packageData, false);
  const ivs = packageData.chunks.map((chunk) =>
    Buffer.from(chunk.iv, "base64").toString("hex"),
  );
  assert.equal(ivs.every((iv) => iv.length === 24), true);
  assert.equal(new Set(ivs).size, packageData.chunks.length);
  const separateKey = JSON.parse(await keyBlob.text());
  assert.equal(Buffer.from(separateKey.key, "base64").length, 32);
  const result = await decryptPackage(packageBlob, keyBlob);
  assert.equal(result.fileName, file.name);
  assert.equal(result.fileSize, input.length);
  assert.deepEqual(
    new Uint8Array(await result.blob.arrayBuffer()),
    input,
  );
});

test("a file smaller than the default 1 MiB block uses one block", async () => {
  const input = new TextEncoder().encode("small file");
  const { packageBlob, keyBlob, packageData } = await encryptSample(
    input,
    CLOUD_BOX.defaultBlockBytes,
  );
  assert.equal(packageData.blockCount, 1);
  const result = await decryptPackage(packageBlob, keyBlob);
  assert.deepEqual(
    new Uint8Array(await result.blob.arrayBuffer()),
    input,
  );
});

test("handles an empty file with a valid separate key", async () => {
  const { packageBlob, keyBlob, packageData } = await encryptSample(new Uint8Array());
  assert.equal(packageData.blockCount, 0);
  const result = await decryptPackage(packageBlob, keyBlob);
  assert.equal(result.fileSize, 0);
  assert.equal((await result.blob.arrayBuffer()).byteLength, 0);
});

test("rejects a package encrypted with a different key", async () => {
  const first = await encryptSample(new TextEncoder().encode("first"));
  const second = await encryptSample(new TextEncoder().encode("second"));
  await assert.rejects(
    decryptPackage(first.packageBlob, second.keyBlob),
    /failed authentication/,
  );
});

test("rejects ciphertext modified after encryption", async () => {
  const encrypted = await encryptSample(new TextEncoder().encode("integrity check"));
  const data = structuredClone(encrypted.packageData);
  const ciphertext = Buffer.from(data.chunks[0].ciphertext, "base64");
  ciphertext[0] ^= 1;
  data.chunks[0].ciphertext = ciphertext.toString("base64");
  await assert.rejects(
    decryptPackage(await jsonBlob(data), encrypted.keyBlob),
    /failed authentication/,
  );
});

test("rejects missing blocks and duplicate block indexes", async () => {
  const encrypted = await encryptSample(
    new Uint8Array(CLOUD_BOX.minBlockBytes + 1),
  );
  const missing = structuredClone(encrypted.packageData);
  missing.chunks.pop();
  await assert.rejects(
    decryptPackage(await jsonBlob(missing), encrypted.keyBlob),
    /missing or extra encrypted blocks/,
  );

  const duplicate = structuredClone(encrypted.packageData);
  duplicate.chunks[1].index = duplicate.chunks[0].index;
  await assert.rejects(
    decryptPackage(await jsonBlob(duplicate), encrypted.keyBlob),
    /duplicate, missing, or out-of-order/,
  );
});

test("rejects invalid metadata and invalid raw key length", async () => {
  const encrypted = await encryptSample(new TextEncoder().encode("metadata"));
  const wrongSize = structuredClone(encrypted.packageData);
  wrongSize.originalSize += 1;
  await assert.rejects(
    decryptPackage(await jsonBlob(wrongSize), encrypted.keyBlob),
    /inconsistent encrypted size/,
  );
  const invalidKey = await jsonBlob({
    format: "cloudbox-key",
    version: 1,
    algorithm: "AES-256-GCM",
    key: Buffer.from(new Uint8Array(16)).toString("base64"),
  });
  await assert.rejects(
    decryptPackage(encrypted.packageBlob, invalidKey),
    /exactly 256 bits/,
  );
});

test("rejects files over the input limit before reading their contents", async () => {
  const oversized = {
    name: "too-large.bin",
    size: CLOUD_BOX.maxInputBytes + 1,
    slice() {
      assert.fail("oversized file contents must not be read");
    },
  };
  await assert.rejects(encryptFile(oversized, CLOUD_BOX.defaultBlockBytes), /100 MiB/);
});

test("rejects unsupported block sizes", async () => {
  await assert.rejects(
    encryptFile(makeFile(new Uint8Array([1])), 32),
    /between 64 KiB and 8 MiB/,
  );
});
