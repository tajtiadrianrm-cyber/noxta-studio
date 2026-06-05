// Noxta Admin — backend wrapper.
// All admin actions are POST /api/admin with { password, action, ...payload }.
// Password is held in sessionStorage as "admin-pw" (Szabina pattern, line 509).
// Worker rejects every request that lacks the right password (no implicit session).

const PW_KEY = "admin-pw";

// Per-file SHA cache — needed by GitHub Contents API to detect concurrent edits.
// Read fills it; write echoes it back and updates with the response SHA.
const shaCache = new Map();

export function getPassword() {
  return sessionStorage.getItem(PW_KEY) || "";
}

export function setPassword(pw) {
  sessionStorage.setItem(PW_KEY, pw);
}

export function clearPassword() {
  sessionStorage.removeItem(PW_KEY);
  shaCache.clear();
}

/**
 * Generic call. Throws on non-2xx; the thrown Error carries `.status` and `.body`.
 * Callers catch 401 to force re-login.
 */
async function call(action, payload = {}) {
  const password = getPassword();
  if (!password) {
    const e = new Error("Not authenticated");
    e.status = 401;
    throw e;
  }
  let res;
  try {
    res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, action, ...payload }),
    });
  } catch (netErr) {
    const e = new Error("Network error — is the site online?");
    e.status = 0;
    throw e;
  }
  let body;
  try {
    body = await res.json();
  } catch {
    const e = new Error(`Bad response (${res.status})`);
    e.status = res.status;
    throw e;
  }
  if (!res.ok || body.ok === false) {
    const e = new Error(body.error || `HTTP ${res.status}`);
    e.status = res.status;
    e.body = body;
    throw e;
  }
  return body;
}

// ─── Public actions ──────────────────────────────────────

/** Verify password only. Returns true on success, throws on failure. */
export async function login() {
  await call("login");
  return true;
}

/** Read a JSON file from the repo. Caches SHA. */
export async function readJson(path) {
  const res = await call("read", { path });
  shaCache.set(path, res.sha);
  return res.data;
}

/** Write a JSON file. Uses cached SHA for conflict detection. */
export async function writeJson(path, content, message) {
  const sha = shaCache.get(path);
  const res = await call("write-json", {
    path,
    content,
    sha,
    message: message || `admin: update ${path}`,
  });
  shaCache.set(path, res.sha);
  return res;
}

/** Upload an image given a base64 string (no data: prefix). */
export async function uploadImage(path, contentBase64, message) {
  const res = await call("upload-image", {
    path,
    contentBase64,
    message: message || `admin: upload ${path}`,
  });
  return res;
}

/** Delete a file. Idempotent — succeeds on 404. */
export async function deleteFile(path, message) {
  return await call("delete-file", {
    path,
    message: message || `admin: delete ${path}`,
  });
}

/** Read a File object as base64 (no data: prefix). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.readAsDataURL(file);
  });
}
