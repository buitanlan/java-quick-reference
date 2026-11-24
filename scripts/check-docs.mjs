#!/usr/bin/env node
/**
 * Static documentation integrity checker for java-quick-reference.
 * Verifies:
 *  1. UTF-8 integrity (no U+FFFD replacement chars or NUL bytes)
 *  2. Balanced fenced code blocks (``` / ````)
 *  3. Valid internal Markdown file links and GitHub-style heading anchors
 *  4. Every non-README topic .md file is linked from README.md
 *
 * Usage: node scripts/check-docs.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

function slugifyGfm(headingText) {
  let s = headingText.trim().toLowerCase();
  s = s.replace(/`/g, "");
  let out = "";
  for (const ch of s) {
    if (/[\p{L}\p{N} _-]/u.test(ch)) {
      out += ch;
    }
  }
  return out.replace(/ /g, "-");
}

function listMarkdownFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => d.name)
    .sort();
}

const files = listMarkdownFiles(ROOT);
const anchorsByFile = new Map();
const errors = [];

// Pass 1: encoding check, code fence balance, and collect heading anchors
for (const file of files) {
  const fullPath = path.join(ROOT, file);
  const content = fs.readFileSync(fullPath, "utf8");

  if (content.includes("\uFFFD")) {
    errors.push(`${file}: contains Unicode replacement character (U+FFFD) — possible encoding corruption`);
  }
  if (content.includes("\u0000")) {
    errors.push(`${file}: contains NUL byte`);
  }

  const lines = content.split(/\r?\n/);
  const anchors = new Set();
  const counts = new Map();
  let fenceChar = null;
  let fenceLen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenceChar) {
        fenceChar = marker[0];
        fenceLen = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLen && trimmed.slice(marker.length).trim() === "") {
        fenceChar = null;
        fenceLen = 0;
      }
      continue;
    }

    if (fenceChar) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const raw = headingMatch[1].trim().replace(/\s+#+\s*$/, "");
      const base = slugifyGfm(raw);
      const count = counts.get(base) ?? 0;
      counts.set(base, count + 1);
      const slug = count === 0 ? base : `${base}-${count}`;
      anchors.add(slug);
    }
  }

  if (fenceChar) {
    errors.push(`${file}: unclosed fenced code block (${fenceChar.repeat(fenceLen)})`);
  }

  anchorsByFile.set(file, anchors);
}

// Pass 2: verify internal links & anchors
const readmeLinkedFiles = new Set();
const linkRegex = /!?\[[^\]]*\]\(([^)]+)\)/g;

for (const file of files) {
  const fullPath = path.join(ROOT, file);
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  let fenceChar = null;
  let fenceLen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenceChar) {
        fenceChar = marker[0];
        fenceLen = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLen && trimmed.slice(marker.length).trim() === "") {
        fenceChar = null;
        fenceLen = 0;
      }
      continue;
    }

    if (fenceChar) continue;

    // Strip inline code spans before scanning links
    const withoutCode = line.replace(/`[^`]*`/g, "");
    for (const match of withoutCode.matchAll(linkRegex)) {
      let target = match[1].trim();
      if (target.startsWith("<") && target.endsWith(">")) {
        target = target.slice(1, -1).trim();
      }
      // Strip optional title
      target = target.split(/\s+/)[0];

      if (/^(https?:|mailto:|#?$)/i.test(target)) continue;

      const hashIdx = target.indexOf("#");
      const relFile = hashIdx === -1 ? target : target.slice(0, hashIdx);
      const fragment = hashIdx === -1 ? null : target.slice(hashIdx + 1);
      const targetFile = relFile === "" ? file : relFile;

      if (file === "README.md" && relFile.endsWith(".md")) {
        readmeLinkedFiles.add(relFile);
      }

      if (relFile !== "") {
        const resolved = path.resolve(ROOT, relFile);
        if (!fs.existsSync(resolved)) {
          errors.push(`${file}:${i + 1}: broken file link -> ${target}`);
          continue;
        }
      }

      if (fragment !== null) {
        const targetAnchors = anchorsByFile.get(targetFile);
        if (!targetAnchors) {
          errors.push(`${file}:${i + 1}: anchor target not indexed -> ${target}`);
        } else if (!targetAnchors.has(fragment)) {
          errors.push(`${file}:${i + 1}: broken anchor -> ${target} (no heading #${fragment} in ${targetFile})`);
        }
      }
    }
  }
}

// Pass 3: ensure all topic files are listed in README.md
for (const file of files) {
  if (file !== "README.md" && !readmeLinkedFiles.has(file)) {
    errors.push(`README.md: topic file '${file}' is not linked in README.md`);
  }
}

if (errors.length > 0) {
  console.error(`check-docs FAILED (${errors.length} issue(s) across ${files.length} files):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`check-docs OK: ${files.length} Markdown files checked, 0 issues.`);
