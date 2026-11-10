// Checks extensions for a pull request.
//
//   node scripts/check.mjs --base origin/main   the extensions the branch changes
//   node scripts/check.mjs --all                every extension
//   node scripts/check.mjs author/name …        these extensions
//
// Installs dependencies without lifecycle scripts, typechecks, builds with the
// standard build, then runs `notchnotch check` and `notchnotch lint`.
import { lstat, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  changedHandles, checkFolder, compareVersions, folderOf, isVersion, listHandles, publishedCatalog, readManifest, run,
} from "./lib.mjs";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { base: { type: "string" }, all: { type: "boolean" } } });
const handles = values.all ? await listHandles() : values.base ? changedHandles(values.base) : positionals;
if (!handles.length) { console.log("No extensions changed."); process.exit(0); }

const catalog = publishedCatalog();
const published = new Map((catalog?.extensions ?? []).map((entry) => [entry.handle, entry]));
const publishedIDs = new Map((catalog?.extensions ?? []).map((entry) => [entry.manifest.id, entry.handle]));
const ids = new Map();
for (const handle of await listHandles()) {
  const id = await readManifest(handle).then((manifest) => manifest.id, () => null);
  if (id) ids.set(id, [...(ids.get(id) ?? []), handle]);
}

const output = await mkdtemp(path.join(tmpdir(), "notchnotch-check-"));
let failed = false;
for (const handle of handles) {
  console.log(`\n▸ ${handle}`);
  const folder = folderOf(handle);
  if (!(await lstat(folder).then(() => true, () => false))) {
    console.log(published.has(handle) ? "  Removed: it leaves the Store when this merges." : "  Removed.");
    continue;
  }
  const problems = await checkFolder(handle);
  const manifest = await readManifest(handle).catch(() => null);
  if (manifest) {
    if (!isVersion(manifest.version)) problems.push(`version "${manifest.version}" must be numbers separated by dots, such as 1.2.0`);
    if ((ids.get(manifest.id) ?? []).length > 1) problems.push(`id ${manifest.id} is also used by ${ids.get(manifest.id).filter((h) => h !== handle).join(", ")}`);
    const owner = publishedIDs.get(manifest.id);
    if (owner && owner !== handle) problems.push(`id ${manifest.id} belongs to ${owner} in the Store`);
    const previous = published.get(handle);
    if (previous && previous.manifest.id !== manifest.id) problems.push(`the id can't change from ${previous.manifest.id}; installed copies would stop updating`);
    if (previous && isVersion(manifest.version) && compareVersions(manifest.version, previous.manifest.version) <= 0) {
      problems.push(`version ${manifest.version} must be higher than the Store's ${previous.manifest.version}; add a CHANGELOG entry too`);
    }
  }
  if (!problems.length) {
    try {
      const lockfile = await lstat(path.join(folder, "package-lock.json")).then(() => true, () => false);
      run("npm", [lockfile ? "ci" : "install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: folder });
      if (await lstat(path.join(folder, "tsconfig.json")).then(() => true, () => false)) run("npx", ["--no-install", "tsc", "--noEmit"], { cwd: folder });
      run("npx", ["--no-install", "notchnotch", "build", ".", "--out", path.join(output, handle)], { cwd: folder });
      run("npx", ["--no-install", "notchnotch", "lint", "."], { cwd: folder });
    } catch (error) {
      problems.push(error.message.split("\n")[0]);
    }
  }
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  if (problems.length) failed = true; else console.log("  ✓ Ready for review");
}
process.exit(failed ? 1 : 0);
