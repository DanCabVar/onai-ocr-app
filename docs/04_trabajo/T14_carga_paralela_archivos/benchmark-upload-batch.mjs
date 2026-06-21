#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k.startsWith("--")) {
      args[k.slice(2)] = v;
      i += 1;
    }
  }
  return args;
}

function nowIso() {
  return new Date().toISOString();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadBatch({ baseUrl, token, files }) {
  const form = new FormData();
  for (const f of files) {
    const bytes = fs.readFileSync(f.absPath);
    const blob = new Blob([bytes], { type: f.mimeType });
    form.append("files", blob, f.name);
  }

  const startedAt = Date.now();
  const resp = await fetch(`${baseUrl}/documents/upload-batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await resp.json();
  const endedAt = Date.now();

  return {
    ok: resp.ok,
    status: resp.status,
    body,
    uploadMs: endedAt - startedAt,
  };
}

async function pollBatchStatus({ baseUrl, token, documentIds, maxAttempts = 180, intervalMs = 2000 }) {
  const startedAt = Date.now();
  let last = null;
  for (let i = 0; i < maxAttempts; i += 1) {
    const resp = await fetch(`${baseUrl}/documents/batch-status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentIds }),
    });
    const body = await resp.json();
    last = body;
    if (resp.ok && body?.allDone) {
      return {
        done: true,
        attempts: i + 1,
        pollMs: Date.now() - startedAt,
        status: body,
      };
    }
    await sleep(intervalMs);
  }
  return {
    done: false,
    attempts: maxAttempts,
    pollMs: Date.now() - startedAt,
    status: last,
  };
}

function toMimeByExt(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = args.baseUrl || "http://localhost:4000/api";
  const token = args.token;
  const dir = args.dir;
  const runs = Number(args.runs || 1);

  if (!token || !dir) {
    console.error("Uso: node benchmark-upload-batch.mjs --baseUrl <url> --token <jwt> --dir <folder> --runs 3");
    process.exit(1);
  }

  const names = fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isFile());
  if (names.length === 0) {
    console.error("No hay archivos para subir en:", dir);
    process.exit(1);
  }

  const files = names.map((name) => ({
    name,
    absPath: path.join(dir, name),
    mimeType: toMimeByExt(name),
  }));

  const results = [];

  for (let run = 1; run <= runs; run += 1) {
    const startIso = nowIso();
    const upload = await uploadBatch({ baseUrl, token, files });
    if (!upload.ok) {
      results.push({
        run,
        startedAt: startIso,
        uploadMs: upload.uploadMs,
        failed: true,
        httpStatus: upload.status,
        response: upload.body,
      });
      continue;
    }

    const documentIds = Array.isArray(upload.body?.documentIds) ? upload.body.documentIds : [];
    let poll = { done: false, attempts: 0, pollMs: 0, status: null };
    if (documentIds.length > 0) {
      poll = await pollBatchStatus({ baseUrl, token, documentIds });
    }

    const status = poll.status || {};
    results.push({
      run,
      startedAt: startIso,
      uploadMs: upload.uploadMs,
      pollMs: poll.pollMs,
      totalMs: upload.uploadMs + poll.pollMs,
      done: poll.done,
      attempts: poll.attempts,
      total: status.total,
      completed: status.completed,
      pendingConfirmation: status.pendingConfirmation,
      errors: status.errors,
    });
  }

  const out = {
    generatedAt: nowIso(),
    baseUrl,
    runs,
    fileCount: files.length,
    results,
  };

  const outPath = path.join(process.cwd(), "docs/04_trabajo/T14_carga_paralela_archivos/benchmark-output.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out, null, 2));
  console.log(`\nResultado guardado en: ${outPath}`);
}

main().catch((e) => {
  console.error("Benchmark failed:", e);
  process.exit(1);
});
