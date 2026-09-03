#!/usr/bin/env node
/**
 * test_combo_models.js
 *
 * Tes semua model slug di combo 9Router Anda satu per satu,
 * lalu laporkan mana yang OK, mana yang 404/deprecated/error.
 *
 * Cara pakai:
 *   1. Isi array MODELS di bawah dengan 17/27 slug combo Anda
 *      (atau jalankan dengan --file=models.json berisi array string)
 *   2. node test_combo_models.js
 *
 * Contoh models.json:
 *   ["openrouter/google/gemma-4-31b-it:free", "gemini/gemini-2.5-pro", ...]
 */

const BASE_URL = process.env.NINE_ROUTER_URL || "http://localhost:20128/v1";
const TIMEOUT_MS = 15000;

// Ganti / lengkapi daftar ini dengan slug combo Anda,
// atau jalankan: node test_combo_models.js --file=models.json
const MODELS = [
  "openrouter/google/gemma-4-31b-it:free",
  "openrouter/nvidia/nemotron-3-nano-30b-a3b:free",
  "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "gemini/gemini-2.5-pro",
];

function loadModelsFromFile(path) {
  const fs = require("fs");
  const raw = fs.readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("File JSON harus berupa array string slug model");
  return parsed;
}

function getModelList() {
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  if (fileArg) {
    const path = fileArg.split("=")[1];
    console.log(`Memuat daftar model dari ${path}...\n`);
    return loadModelsFromFile(path);
  }
  return MODELS;
}

async function testModel(model) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
        stream: false,
      }),
      signal: controller.signal,
    });

    const elapsed = Date.now() - start;
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg = json?.error?.message || text.slice(0, 200);
      return { model, status: "FAIL", httpStatus: res.status, elapsed, detail: msg };
    }

    const outText = json?.choices?.[0]?.message?.content ?? "";
    const usage = json?.usage;
    const outTokens = usage?.completion_tokens ?? (outText ? "?" : 0);

    if (!outText && outTokens === 0) {
      return { model, status: "ZERO_TOKEN", httpStatus: res.status, elapsed, detail: "Response 200 tapi output kosong (0 token)" };
    }

    return { model, status: "OK", httpStatus: res.status, elapsed, detail: `output: "${String(outText).slice(0, 40)}"` };
  } catch (err) {
    const elapsed = Date.now() - start;
    if (err.name === "AbortError") {
      return { model, status: "TIMEOUT", httpStatus: null, elapsed, detail: `Tidak respons dalam ${TIMEOUT_MS}ms` };
    }
    return { model, status: "ERROR", httpStatus: null, elapsed, detail: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const models = getModelList();
  console.log(`Testing ${models.length} model via ${BASE_URL}\n`);

  const results = [];
  for (const model of models) {
    process.stdout.write(`→ ${model} ... `);
    const result = await testModel(model);
    results.push(result);
    console.log(`${result.status} (${result.elapsed}ms)`);
  }

  const ok = results.filter((r) => r.status === "OK");
  const dead = results.filter((r) => r.status !== "OK");

  console.log("\n========== RINGKASAN ==========\n");

  console.log(`✅ OK (${ok.length}):`);
  ok.forEach((r) => console.log(`   - ${r.model}`));

  console.log(`\n❌ BERMASALAH (${dead.length}):`);
  dead.forEach((r) => console.log(`   - ${r.model} [${r.status}] ${r.detail}`));

  console.log("\n================================\n");

  if (dead.length > 0) {
    console.log("Slug yang disarankan DIHAPUS dari combo:");
    dead.forEach((r) => console.log(`  "${r.model}",`));
  }
}

main().catch((err) => {
  console.error("Script gagal jalan:", err);
  process.exit(1);
});
