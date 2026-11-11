// Releases the packages build-packages.mjs made and publishes a new signed
// catalog to the `catalog` branch.
//
//   CATALOG_PRIVATE_KEY=… node scripts/publish.mjs <out> [--refresh]
//
// Runs no extension code: it reads each package's notchnotch.json as data,
// hashes the file, uploads it and signs index.json. --refresh re-signs an
// unchanged catalog with a new expiry; the schedule runs it weekly.
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  attempt, catalogLifetimeDays, folderOf, listHandles, maximumScreenshots, minimumAppVersionFor, publishedCatalog, readManifest,
  rehome, releaseNames, repository, root, run, sha256, signBytes, verifyBytes,
} from "./lib.mjs";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { refresh: { type: "boolean" }, "dry-run": { type: "boolean" } } });
const out = path.resolve(positionals[0] ?? "out");
const dryRun = values["dry-run"];
const key = process.env.CATALOG_PRIVATE_KEY;
if (!key && !dryRun) throw new Error("Set CATALOG_PRIVATE_KEY");
const publicKey = await readFile(path.join(root, "catalog-public-key"), "utf8");
const commit = process.env.GITHUB_SHA || run("git", ["rev-parse", "HEAD"], { cwd: root, capture: true }).trim();
const raw = (handle, file) => `https://raw.githubusercontent.com/${repository}/${commit}/extensions/${handle}/${file}`;
const exists = (file) => readFile(file).then(() => true, () => false);

const previous = publishedCatalog();
const kept = new Map((previous?.extensions ?? []).map((entry) => [entry.handle, entry]));
const plan = new Map(JSON.parse(await readFile(path.join(out, "plan.json"), "utf8")).map((item) => [item.handle, item]));
const now = new Date();

const extensions = [];
for (const handle of await listHandles()) {
  const source = await readManifest(handle);
  const old = kept.get(handle);
  if (old?.manifest.version === source.version) { extensions.push(rehome(old)); continue; }
  const item = plan.get(handle);
  if (!item || item.version !== source.version) throw new Error(`${handle} ${source.version} wasn't built`);
  const file = path.join(out, item.file);
  const bytes = await readFile(file);
  // The manifest inside the package is what the app compares with the catalog.
  const manifest = JSON.parse(run("unzip", ["-p", file, "notchnotch.json"], { capture: true }));
  if (manifest.id !== source.id || manifest.version !== source.version) throw new Error(`${handle}: the package's manifest doesn't match the source`);
  const { tag, asset } = releaseNames(handle, source.version);
  const url = `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${asset}`;
  if (!dryRun) {
    const notes = `${manifest.name} ${manifest.version} for the NotchNotch Store.`;
    // A rerun after a failed publish finds the release already made.
    if (attempt("gh", ["release", "view", tag, "--repo", repository]) === null) run("gh", ["release", "create", tag, file, "--repo", repository, "--target", commit, "--title", `${manifest.name} ${manifest.version}`, "--notes", notes]);
    else run("gh", ["release", "upload", tag, file, "--repo", repository, "--clobber"]);
  }
  const entry = { handle, manifest, package: { url, sha256: sha256(bytes), size: bytes.length } };
  if (typeof manifest.icon === "string" && manifest.icon.endsWith(".png")) entry.icon = raw(handle, `assets/${manifest.icon}`);
  const screenshots = (await readdir(path.join(folderOf(handle), "metadata")).catch(() => []))
    .filter((name) => name.endsWith(".png")).sort().slice(0, maximumScreenshots);
  if (screenshots.length) entry.screenshots = screenshots.map((name) => raw(handle, `metadata/${name}`));
  for (const [key, file] of [["readme", "README.md"], ["changelog", "CHANGELOG.md"]]) {
    if (await exists(path.join(folderOf(handle), file))) entry[key] = raw(handle, file);
  }
  entry.minimumAppVersion = minimumAppVersionFor(manifest);
  entry.published = now.toISOString().replace(/\.\d+Z$/, "Z");
  extensions.push(entry);
  console.log(`▸ ${handle} ${manifest.version} released`);
}

const changed = JSON.stringify(extensions) !== JSON.stringify(previous?.extensions ?? null);
const expiresSoon = previous && new Date(previous.expires) - now < 10 * 86_400_000;
if (!changed && !values.refresh && !expiresSoon) { console.log("The catalog is up to date."); process.exit(0); }

const catalog = {
  format: 1,
  sequence: (previous?.sequence ?? 0) + 1,
  generated: now.toISOString().replace(/\.\d+Z$/, "Z"),
  expires: new Date(now.getTime() + catalogLifetimeDays * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z"),
  extensions,
};
const body = Buffer.from(JSON.stringify(catalog, null, 2) + "\n");
if (dryRun) { await writeFile(path.join(out, "index.json"), body); console.log(`Dry run: wrote ${path.join(out, "index.json")}`); process.exit(0); }
const signature = signBytes(body, key);
// Catch a secret that doesn't match the key the app trusts before publishing.
if (!verifyBytes(body, signature, publicKey)) throw new Error("CATALOG_PRIVATE_KEY doesn't match catalog-public-key");

// git worktree add wants a path that doesn't exist yet.
const worktree = path.join(await mkdtemp(path.join(tmpdir(), "catalog-")), "catalog");
if (previous) run("git", ["worktree", "add", "--detach", worktree, "FETCH_HEAD"], { cwd: root });
else run("git", ["worktree", "add", "--orphan", "-b", "catalog", worktree], { cwd: root });
await writeFile(path.join(worktree, "index.json"), body);
await writeFile(path.join(worktree, "index.json.sig"), signature + "\n");
run("git", ["add", "index.json", "index.json.sig"], { cwd: worktree });
run("git", ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
  "commit", "--quiet", "-m", `Catalog ${catalog.sequence}`], { cwd: worktree });
run("git", ["push", "--quiet", "origin", "HEAD:refs/heads/catalog"], { cwd: worktree });
console.log(`Published catalog ${catalog.sequence} with ${extensions.length} extension${extensions.length === 1 ? "" : "s"}, valid until ${catalog.expires}.`);
