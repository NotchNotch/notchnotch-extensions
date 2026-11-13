// Shared rules for the Store's CI. Only Node built-ins: nothing from an
// extension's dependencies runs in the job that holds the signing key.
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repository = process.env.GITHUB_REPOSITORY || "NotchNotch/notchnotch-extensions";
export const extensionsDirectory = path.join(root, "extensions");
/** The first NotchNotch with the Store. Raise it when the catalog needs a newer app. */
export const minimumAppVersion = "0.7.0";
/** The first NotchNotch that serves each system capability or permission, by permission name. Older apps reject a permission they don't know. */
export const capabilityAppVersions = { calendar: "0.9.0", "now-playing": "0.9.0", battery: "0.11.0", system: "0.11.0", "file-read": "0.14.0" };
/**
 * The first NotchNotch that draws each component, by node type. An older app
 * rejects a whole snapshot with a node type it doesn't know (0.11 and later
 * leave it out instead).
 */
export const componentAppVersions = {
  value: "0.11.0", ring: "0.11.0", dropZone: "0.14.0", fileItem: "0.14.0", fileGrid: "0.14.0",
};

/** Node types an extension's bundle creates. The SDK's components call createElement("<type>", …). */
export function componentsIn(bundle) {
  return new Set([...bundle.matchAll(/createElement\)?\(\s*"([A-Za-z]+)"/g)].map((match) => match[1]));
}

/** The oldest app that can run this package: the Store's, or newer for a capability or component it uses. */
export function minimumAppVersionFor(manifest, bundle = "") {
  const components = [...componentsIn(bundle)].map((type) => componentAppVersions[type]);
  return [...(manifest.permissions ?? []).map((name) => capabilityAppVersions[name]), ...components].filter(Boolean)
    .reduce((highest, version) => compareVersions(version, highest) > 0 ? version : highest, minimumAppVersion);
}
export const catalogLifetimeDays = 30;
export const maximumScreenshots = 6;

const handlePattern = /^[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9][a-z0-9-]{0,63}$/;

/** Runs a command, throwing with its output if it fails. */
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: options.capture ? "pipe" : "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed${result.stderr ? `:\n${result.stderr}` : ""}`);
  }
  return result.stdout ?? "";
}

/** Like run, but returns null instead of throwing. */
export function attempt(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
  return result.status === 0 ? result.stdout : null;
}

/** Every `extensions/<author>/<name>` folder, as `author/name`. */
export async function listHandles() {
  const handles = [];
  for (const author of (await readdir(extensionsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
    for (const name of await readdir(path.join(extensionsDirectory, author.name), { withFileTypes: true })) {
      if (name.isDirectory()) handles.push(`${author.name}/${name.name}`);
    }
  }
  return handles.sort();
}

/** Handles whose folders a pull request touches, including ones it deletes. */
export function changedHandles(base) {
  const files = run("git", ["diff", "--name-only", `${base}...HEAD`, "--", "extensions"], { cwd: root, capture: true });
  const handles = new Set();
  for (const file of files.split("\n")) {
    const parts = file.split("/");
    if (parts.length >= 4) handles.add(`${parts[1]}/${parts[2]}`);
  }
  return [...handles].sort();
}

export const folderOf = (handle) => path.join(extensionsDirectory, ...handle.split("/"));

export async function readManifest(handle) {
  return JSON.parse(await readFile(path.join(folderOf(handle), "notchnotch.json"), "utf8"));
}

/** Folder rules a reviewer shouldn't have to check by eye. Returns problems. */
export async function checkFolder(handle) {
  const problems = [];
  if (!handlePattern.test(handle)) problems.push(`${handle}: the folder must be extensions/<author>/<name> in lowercase letters, digits and dashes`);
  const folder = folderOf(handle);
  let manifest;
  try { manifest = await readManifest(handle); } catch (error) { return [...problems, `${handle}: notchnotch.json can't be read: ${error.message}`]; }
  const [author] = handle.split("/");
  if (manifest.author !== author) problems.push(`${handle}: notchnotch.json "author" must be "${author}", the folder's author`);
  if (!(await exists(path.join(folder, "package.json")))) problems.push(`${handle}: package.json is missing`);
  if (await exists(path.join(folder, "build.mjs"))) problems.push(`${handle}: build.mjs isn't allowed in the Store yet; the build must be the standard one`);
  if (await exists(path.join(folder, "helpers"))) problems.push(`${handle}: native helpers aren't in the Store yet`);
  for (const file of trackedFiles(folder)) {
    const relative = path.relative(folder, file);
    if (/(^|\/)(node_modules|dist)(\/|$)/.test(relative)) { problems.push(`${handle}: ${relative.split("/")[0]}/ must not be committed`); break; }
    if (relative.endsWith(".notchext")) problems.push(`${handle}: ${relative} must not be committed; CI builds the package`);
    else if (await isBinaryExecutable(file)) problems.push(`${handle}: ${relative} is a compiled program; only source is accepted`);
  }
  return problems;
}

async function exists(file) { return lstat(file).then(() => true, () => false); }

/** Files git tracks or would add, so local node_modules/ and dist/ (ignored) don't count. */
function trackedFiles(folder) {
  return run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", folder], { cwd: root, capture: true })
    .split("\0").filter(Boolean).map((file) => path.join(root, file));
}

/** Mach-O, fat and ELF headers, or any file with an executable bit that isn't a script. */
async function isBinaryExecutable(file) {
  const info = await lstat(file);
  if (!info.isFile()) return true;
  const head = (await readFile(file)).subarray(0, 4).toString("hex");
  const magic = ["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe", "bebafeca", "7f454c46"];
  return magic.includes(head) || ((info.mode & 0o111) !== 0 && !head.startsWith("2321"));
}

/** Dotted numeric comparison, matching the app's. */
export function compareVersions(a, b) {
  const left = a.split(".").map(Number), right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const x = left[index] ?? 0, y = right[index] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export const isVersion = (value) => typeof value === "string" && /^\d+(\.\d+){0,3}$/.test(value);

/**
 * The published catalog, or null before the first one. Read from the `catalog`
 * branch with git, not raw.githubusercontent.com, whose cache can be minutes old.
 */
export function publishedCatalog() {
  const fetched = spawnSync("git", ["fetch", "--quiet", "origin", "catalog"], { cwd: root, encoding: "utf8" });
  if (fetched.status !== 0) {
    if (/couldn't find remote ref/.test(fetched.stderr)) return null;
    throw new Error(`Couldn't fetch the catalog branch: ${fetched.stderr}`);
  }
  return JSON.parse(run("git", ["show", "FETCH_HEAD:index.json"], { cwd: root, capture: true }));
}

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const pkcs8 = Buffer.from("302e020100300506032b657004220420", "hex");
const spki = Buffer.from("302a300506032b6570032100", "hex");

/** Base64 Ed25519 signature over `bytes` with a base64 32-byte seed. */
export function signBytes(bytes, seedBase64) {
  const seed = Buffer.from(seedBase64.trim(), "base64");
  if (seed.length !== 32) throw new Error("CATALOG_PRIVATE_KEY is not a base64 Ed25519 seed");
  return sign(null, bytes, createPrivateKey({ key: Buffer.concat([pkcs8, seed]), format: "der", type: "pkcs8" })).toString("base64");
}

export function verifyBytes(bytes, signatureBase64, publicKeyBase64) {
  const key = createPublicKey({ key: Buffer.concat([spki, Buffer.from(publicKeyBase64.trim(), "base64")]), format: "der", type: "spki" });
  return verify(null, bytes, key, Buffer.from(signatureBase64.trim(), "base64"));
}

/** Release tag and asset name for one version. `.` can't appear in a handle, so tags never collide. */
export function releaseNames(handle, version) {
  const [author, name] = handle.split("/");
  return { tag: `${author}.${name}@${version}`, asset: `${name}-${version}.notchext` };
}

/**
 * Points an unchanged catalog entry's links at this repository's current
 * owner, after the repository moved. GitHub redirects the old links, but only
 * until someone reuses the old name. Hashes stay the same, so nothing the app
 * verifies changes.
 */
export function rehome(entry, current = repository) {
  const name = current.split("/")[1];
  const pattern = new RegExp(`^https://(github\\.com|raw\\.githubusercontent\\.com)/[^/]+/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`);
  const move = (url) => typeof url === "string" ? url.replace(pattern, (_, host) => `https://${host}/${current}/`) : url;
  const copy = structuredClone(entry);
  copy.package.url = move(copy.package.url);
  for (const key of ["icon", "readme", "changelog"]) if (copy[key]) copy[key] = move(copy[key]);
  if (copy.screenshots) copy.screenshots = copy.screenshots.map(move);
  return copy;
}
