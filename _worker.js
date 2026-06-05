// Admin function for the Szabina photo journal.
//
// Routes:
//   POST /api/admin   — all admin actions, password-gated
//   anything else     — falls through to the runtime, which serves it as a static asset
//
// Request body shape (JSON):
//   { password, action, ...payload }
//
// Actions:
//   login         — verify password only
//   read          — fetch a JSON file from the repo
//   write-json    — commit an updated JSON file
//   upload-image  — commit a new image (base64 in body)
//   delete-file   — delete a file
//
// Env vars (Cloudflare dashboard → Variables and Secrets):
//   ADMIN_PASSWORD   (secret)
//   GITHUB_TOKEN     (secret — fine-grained PAT, Contents: read+write on noxtastudio/szabina)
//   GITHUB_REPO      (plain, e.g. "noxtastudio/szabina")

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/admin") {
      if (request.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
      return handleAdmin(request, env);
    }

    // TEMPORARY DIAGNOSTIC — reports binding presence/length, not values.
    // Remove this block once login works.
    if (url.pathname === "/api/admin/_diag") {
      const env_keys = Object.keys(env || {});
      return json({
        env_keys,
        has_ADMIN_PASSWORD: typeof env.ADMIN_PASSWORD === "string" && env.ADMIN_PASSWORD.length > 0,
        ADMIN_PASSWORD_length: (env.ADMIN_PASSWORD || "").length,
        has_GITHUB_TOKEN: typeof env.GITHUB_TOKEN === "string" && env.GITHUB_TOKEN.length > 0,
        GITHUB_TOKEN_length: (env.GITHUB_TOKEN || "").length,
        has_GITHUB_REPO: typeof env.GITHUB_REPO === "string" && env.GITHUB_REPO.length > 0,
        GITHUB_REPO_value: env.GITHUB_REPO || "(unset)",
      });
    }

    // Worker only runs when no static asset matched — nothing else to do.
    return new Response("Not found", { status: 404 });
  },
};

// ─── Admin dispatcher ───────────────────────────────────────────────────

async function handleAdmin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  // Single auth gate — every action requires the password
  if (!body.password || body.password !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    switch (body.action) {
      case "login":        return json({ ok: true });
      case "read":         return await actRead(body, env);
      case "write-json":   return await actWriteJson(body, env);
      case "upload-image": return await actUploadImage(body, env);
      case "delete-file":  return await actDeleteFile(body, env);
      default:
        return json({ ok: false, error: `Unknown action: ${body.action}` }, 400);
    }
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}

// ─── GitHub Contents API helpers ────────────────────────────────────────

const GH = "https://api.github.com";

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "szabina-admin",
  };
}

// btoa() requires a binary string. For UTF-8 (non-ASCII chars in captions)
// we must encode first.
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ─── Actions ────────────────────────────────────────────────────────────

// payload: { path }            e.g. path: "data/travel.json"
// returns: { ok, data, sha }   data is the parsed JSON, sha is needed for next write
async function actRead({ path }, env) {
  if (!path) throw new Error("path is required");
  const url = `${GH}/repos/${env.GITHUB_REPO}/contents/${encodeURI(path)}?ref=main`;
  const res = await fetch(url, { headers: ghHeaders(env) });
  if (!res.ok) throw new Error(`GH read ${res.status}: ${await res.text()}`);
  const meta = await res.json();
  return json({ ok: true, data: JSON.parse(base64ToUtf8(meta.content)), sha: meta.sha });
}

// payload: { path, content (object|array), message?, sha? }
// If sha is omitted we fetch the current one — useful for first writes.
async function actWriteJson({ path, content, message, sha }, env) {
  if (!path || content == null) throw new Error("path and content are required");
  const url = `${GH}/repos/${env.GITHUB_REPO}/contents/${encodeURI(path)}`;

  let currentSha = sha;
  if (!currentSha) {
    const cur = await fetch(`${url}?ref=main`, { headers: ghHeaders(env) });
    if (cur.ok) currentSha = (await cur.json()).sha;
  }

  const body = {
    message: message || `admin: update ${path}`,
    content: utf8ToBase64(JSON.stringify(content, null, 2) + "\n"),
    branch: "main",
  };
  if (currentSha) body.sha = currentSha;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GH write ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return json({ ok: true, commit: data.commit.sha, sha: data.content.sha });
}

// payload: { path, contentBase64, message? }
// Rejects if file already exists to prevent silent overwrites.
async function actUploadImage({ path, contentBase64, message }, env) {
  if (!path || !contentBase64) throw new Error("path and contentBase64 are required");
  const url = `${GH}/repos/${env.GITHUB_REPO}/contents/${encodeURI(path)}`;

  const cur = await fetch(`${url}?ref=main`, { headers: ghHeaders(env) });
  if (cur.ok) return json({ ok: false, error: `File exists: ${path}` }, 409);

  const body = {
    message: message || `admin: upload ${path}`,
    content: contentBase64,
    branch: "main",
  };
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GH upload ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return json({ ok: true, commit: data.commit.sha, path: data.content.path });
}

// payload: { path, message? }
async function actDeleteFile({ path, message }, env) {
  if (!path) throw new Error("path is required");
  const url = `${GH}/repos/${env.GITHUB_REPO}/contents/${encodeURI(path)}`;

  const cur = await fetch(`${url}?ref=main`, { headers: ghHeaders(env) });
  // Idempotent: if the file is already gone, treat the delete as already done.
  if (cur.status === 404) return json({ ok: true, alreadyGone: true });
  if (!cur.ok) throw new Error(`GH get-sha ${cur.status}: ${await cur.text()}`);
  const sha = (await cur.json()).sha;

  const body = {
    message: message || `admin: delete ${path}`,
    sha,
    branch: "main",
  };
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GH delete ${res.status}: ${await res.text()}`);
  return json({ ok: true });
}

// ─── Tiny helper ────────────────────────────────────────────────────────

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
