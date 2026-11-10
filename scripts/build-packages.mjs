// Builds a .notchext for every extension whose version isn't in the Store yet.
//
//   node scripts/build-packages.mjs <out>
//
// Runs in a job with no secrets and a read-only token. It writes the packages
// and <out>/plan.json; the publish job hashes, releases and signs them without
// running any extension code.
import { lstat, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkFolder, folderOf, listHandles, publishedCatalog, readManifest, releaseNames, run } from "./lib.mjs";

const out = path.resolve(process.argv[2] ?? "out");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const published = new Map((publishedCatalog()?.extensions ?? []).map((entry) => [entry.handle, entry]));
const plan = [];
for (const handle of await listHandles()) {
  const manifest = await readManifest(handle);
  if (published.get(handle)?.manifest.version === manifest.version) continue;
  const problems = await checkFolder(handle);
  if (problems.length) throw new Error(problems.join("\n"));
  const folder = folderOf(handle);
  const { asset } = releaseNames(handle, manifest.version);
  const built = path.join(out, "build", handle);
  const file = path.join(out, "packages", handle.replace("/", "."), asset);
  await mkdir(path.dirname(file), { recursive: true });
  console.log(`▸ ${handle} ${manifest.version}`);
  const lockfile = await lstat(path.join(folder, "package-lock.json")).then(() => true, () => false);
  run("npm", [lockfile ? "ci" : "install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: folder });
  run("npx", ["--no-install", "notchnotch", "build", ".", "--out", built], { cwd: folder });
  run("npx", ["--no-install", "notchnotch", "pack", built, "--out", file], { cwd: folder });
  plan.push({ handle, version: manifest.version, file: path.relative(out, file) });
}
await rm(path.join(out, "build"), { recursive: true, force: true });
await writeFile(path.join(out, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
console.log(plan.length ? `Built ${plan.length} package${plan.length === 1 ? "" : "s"}.` : "Nothing new to build.");
