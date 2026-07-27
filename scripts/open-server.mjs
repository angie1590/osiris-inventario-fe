#!/usr/bin/env node

import os from "node:os";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT ?? process.argv[2] ?? 5173);
const probeTimeoutMs = Number(process.env.PROBE_TIMEOUT_MS ?? 250);
const concurrency = Number(process.env.PROBE_CONCURRENCY ?? 32);
const fallbackUrl = process.env.FALLBACK_URL ?? `http://localhost:${port}`;

function isPrivateIPv4(address) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function getCandidates() {
  const networks = os.networkInterfaces();
  const prefixes = new Set();

  for (const entries of Object.values(networks)) {
    for (const entry of entries ?? []) {
      if (!entry || entry.family !== "IPv4" || entry.internal) continue;
      if (!isPrivateIPv4(entry.address)) continue;
      const parts = entry.address.split(".");
      if (parts.length !== 4) continue;
      prefixes.add(parts.slice(0, 3).join("."));
    }
  }

  const candidates = ["127.0.0.1", "localhost"];
  for (const prefix of prefixes) {
    for (let host = 1; host <= 254; host += 1) {
      candidates.push(`${prefix}.${host}`);
    }
  }

  return [...new Set(candidates)];
}

async function probe(host) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), probeTimeoutMs);

  try {
    const response = await fetch(`http://${host}:${port}/`, {
      signal: controller.signal,
      redirect: "manual",
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function findServerUrl() {
  const candidates = getCandidates();
  let index = 0;

  async function worker() {
    while (index < candidates.length) {
      const host = candidates[index];
      index += 1;
      if (await probe(host)) return `http://${host}:${port}`;
    }
    return null;
  }

  const found = await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, worker),
  );

  return found.find(Boolean) ?? fallbackUrl;
}

function openUrl(url) {
  const platform = process.platform;
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];

  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}

const url = await findServerUrl();
console.log(`Abriendo ${url}`);
openUrl(url);
