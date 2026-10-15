import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "index.html",
  "architecture.html",
  "documentation.html",
  "security.html",
  "team.html",
  "testing.html",
];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("all six static pages exist and every page links to all six", () => {
  for (const page of pages) {
    assert.equal(fs.existsSync(path.join(root, page)), true, `${page} exists`);
    const html = read(page);
    for (const target of pages) {
      assert.match(html, new RegExp(`href=["']\\./${target}(?:["'#])`), `${page} links to ${target}`);
    }
  }
});

test("all relative HTML assets and page links resolve", () => {
  for (const page of pages) {
    const html = read(page);
    const references = [...html.matchAll(/(?:href|src)=["'](\.\/[^"'#?]+)(?:[?#][^"']*)?["']/g)];
    for (const [, reference] of references) {
      const target = path.resolve(root, reference.slice(2));
      assert.equal(fs.existsSync(target), true, `${page} reference ${reference} exists`);
    }
  }
});

test("documentation page has 25 matching sections and table-of-contents anchors", () => {
  const html = read("documentation.html");
  const sectionIds = [...html.matchAll(/<section class="doc-section" id="([^"]+)"/g)].map((match) => match[1]);
  const tocIds = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  assert.equal(sectionIds.length, 25);
  assert.equal(new Set(sectionIds).size, 25);
  for (const id of sectionIds) assert.ok(tocIds.includes(id), `TOC includes #${id}`);
  assert.match(html, /Hardware and software requirements/);
  assert.match(html, /pnpm --filter @workspace\/cloudbox run dev/);
  assert.match(html, /PowerShell/);
});

test("security page exposes the complete crypto workflow and exact key warning", () => {
  const html = read("security.html");
  const security = read("js/security.js");
  const requiredIds = [
    "encryptForm", "sourceFile", "blockSize", "encryptButton", "encryptProgress",
    "encryptStatus", "blockCount", "packageDownload", "keyDownload", "decryptForm",
    "packageFile", "keyFile", "cloudfrontUrl", "fetchPackageButton", "decryptButton",
    "decryptProgress", "decryptStatus", "outputDownload", "reconstructedMeta",
  ];
  for (const id of requiredIds) assert.match(html, new RegExp(`id="${id}"`), `security control ${id}`);
  assert.match(html, /The encryption key is downloaded separately\. Anyone with both the encrypted package and its key can decrypt the file\. Keep the key private and never upload it to a public website or commit it to Git\./);
  for (const id of ["encryptButton", "fetchPackageButton", "decryptButton"]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*disabled`), `${id} begins disabled`);
  }
  assert.match(html, /<script type="module" src="\.\/js\/security\.js"><\/script>/);
  assert.match(security, /encryptButton\.disabled = !cryptoReady \|\| !sourceInput\?\.files\?\.\[0\]/);
  assert.match(security, /decryptButton\.disabled = true/);
  assert.match(security, /fetchButton\) fetchButton\.disabled = true/);
  assert.match(security, /response\.url && new URL\(response\.url\)\.protocol !== "https:"/);
});

test("team page has four anonymous role placeholders and a separate coordinator", () => {
  const html = read("team.html");
  assert.equal((html.match(/class="card person-card"/g) || []).length, 4);
  for (let index = 1; index <= 4; index += 1) {
    assert.match(html, new RegExp(`\\[Enter Member ${index} name\\]`));
  }
  assert.match(html, /Project owner \/ coordinator: Krushna Kedar/);
});

test("test ledger defines the 26 requested scenarios with editable result controls", () => {
  const html = read("testing.html");
  const app = read("js/app.js");
  const cases = [...app.matchAll(/\{ id: 'TC-\d{2}', scenario:/g)];
  assert.equal(cases.length, 26);
  for (const heading of ["Test ID", "Scenario", "Expected Result", "Actual Result", "Status"]) {
    assert.ok(html.includes(heading), `table includes ${heading}`);
  }
  assert.match(app, /data-actual-control/);
  assert.match(app, /data-label="Actual Result"/);
  assert.match(app, /data-test-control/);
  assert.match(app, /value="blocked">BLOCKED/);
  assert.match(app, /cloudbox-test-status-/);
  assert.match(app, /cloudbox-test-actual-/);
  assert.match(read("css/style.css"), /\.test-matrix thead \{ display: none;/);
});

test("static styles do not depend on an external font service", () => {
  const css = read("css/style.css");
  assert.doesNotMatch(css, /@import\s+url\(['"]https?:/i);
});
