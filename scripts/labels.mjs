// Labels a pull request by what it changes, for review:
//
//   new extension   adds an extension the catalog doesn't have
//   update          changes an extension that is already in the Store
//   new author      adds a folder for an author who has none yet (add them to CODEOWNERS)
//   not the author  changes an extension in someone else's folder
//   store scripts   changes CI, scripts or tests rather than an extension
//
// Runs from `pull_request_target` with the base branch checked out: it reads
// the pull request's file list through the API and never runs its code.
import { fileURLToPath } from "node:url";

export const automaticLabels = {
  "new extension": { color: "0e8a16", description: "Adds an extension to the Store" },
  "update": { color: "1d76db", description: "Changes an extension already in the Store" },
  "new author": { color: "5319e7", description: "First extension from this author: add them to CODEOWNERS" },
  "not the author": { color: "d93f0b", description: "Changes an extension in another author's folder" },
  "store scripts": { color: "fbca04", description: "Changes CI, scripts or tests" },
};

const segment = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * The automatic labels a pull request should have.
 * `files`: changed paths; `author`: the pull request's GitHub login;
 * `onBase(path)`: whether that folder exists on the base branch.
 */
export async function labelsFor({ files, author, onBase }) {
  const labels = new Set();
  const handles = new Set(), authors = new Set();
  for (const file of files) {
    const parts = file.split("/");
    if (parts[0] === "extensions" && parts.length >= 4 && segment.test(parts[1]) && segment.test(parts[2])) {
      handles.add(`${parts[1]}/${parts[2]}`);
      authors.add(parts[1]);
    } else {
      labels.add("store scripts");
    }
  }
  for (const handle of handles) labels.add(await onBase(`extensions/${handle}`) ? "update" : "new extension");
  for (const folder of authors) {
    if (!(await onBase(`extensions/${folder}`))) labels.add("new author");
    if (folder !== author.toLowerCase()) labels.add("not the author");
  }
  return labels;
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository, PR_NUMBER: number, BASE_SHA: base } = process.env;
  const api = async (path, options = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...options.headers },
    });
    if (!response.ok && response.status !== 404) throw new Error(`${options.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
    return response;
  };
  const pull = await (await api(`/pulls/${number}`)).json();
  const files = [];
  for (let page = 1; ; page++) {
    const batch = await (await api(`/pulls/${number}/files?per_page=100&page=${page}`)).json();
    files.push(...batch.flatMap((file) => [file.filename, file.previous_filename].filter(Boolean)));
    if (batch.length < 100) break;
  }
  const onBase = async (path) => (await api(`/contents/${path}?ref=${base}`)).ok;
  const wanted = await labelsFor({ files, author: pull.user.login, onBase });

  for (const [name, label] of Object.entries(automaticLabels)) {
    const exists = (await api(`/labels/${encodeURIComponent(name)}`)).ok;
    if (!exists) await api("/labels", { method: "POST", body: JSON.stringify({ name, ...label }) });
  }
  const current = new Set(pull.labels.map((label) => label.name));
  const add = [...wanted].filter((name) => !current.has(name));
  const remove = Object.keys(automaticLabels).filter((name) => current.has(name) && !wanted.has(name));
  if (add.length) await api(`/issues/${number}/labels`, { method: "POST", body: JSON.stringify({ labels: add }) });
  for (const name of remove) await api(`/issues/${number}/labels/${encodeURIComponent(name)}`, { method: "DELETE" });
  console.log(`Labels: ${[...wanted].join(", ") || "none"}${add.length ? `; added ${add.join(", ")}` : ""}${remove.length ? `; removed ${remove.join(", ")}` : ""}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
