// Lightweight, real-ish helpers used by the forensics terminal.
// These compute ACTUAL results so the sim feels authentic.

// FNV-1a 32-bit hash, rendered as 64 hex chars to look like a sha256.
// (Not cryptographically real sha256, but deterministic & real for the sim.)
export function pseudoSha256(str) {
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4, h3 = 0x1000193, h4 = 0x9e3779b1;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = (h1 ^ c) * 0x01000193 >>> 0;
    h2 = (h2 ^ (c << 1)) * 0x01000193 >>> 0;
    h3 = (h3 ^ (c << 2)) * 0x01000193 >>> 0;
    h4 = (h4 ^ (c << 3)) * 0x01000193 >>> 0;
  }
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return (hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h1 ^ h3) + hex(h2 ^ h4) + hex(h1 ^ h2) + hex(h3 ^ h4));
}

// Extract printable strings from content (mimics the `strings` tool).
export function extractStrings(content, minLen = 4) {
  const matches = content.match(/[\x20-\x7e]{4,}/g) || [];
  return matches.filter((s) => s.length >= minLen);
}

// Simple hexdump of the first N bytes.
export function hexdump(content, maxBytes = 256) {
  const bytes = [];
  for (let i = 0; i < Math.min(content.length, maxBytes); i++) {
    bytes.push(content.charCodeAt(i) & 0xff);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(8, "0");
    const hex = slice.map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = slice.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".")).join("");
    out += `${offset}  ${hex.padEnd(47)}  |${ascii}|\n`;
  }
  return out || "(empty)";
}

// Caesar/ROT decode — a beginner-friendly "cipher" for the tutorial case.
export function rot(str, n) {
  return str.replace(/[a-z]/gi, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + n) % 26) + base);
  });
}

// Base64 decode wrapper (browser atob) with graceful failure.
export function tryBase64Decode(str) {
  try {
    return atob(str.trim());
  } catch {
    return null;
  }
}
