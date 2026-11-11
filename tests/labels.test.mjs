import assert from "node:assert/strict";
import { test } from "node:test";
import { labelsFor } from "../scripts/labels.mjs";

const base = new Set(["extensions/sadeqi-ah", "extensions/sadeqi-ah/weather"]);
const onBase = async (path) => base.has(path);
const labels = async (files, author = "sadeqi-ah") => [...await labelsFor({ files, author, onBase })].sort();

test("an author's change to their own extension is an update", async () => {
  assert.deepEqual(await labels(["extensions/sadeqi-ah/weather/src/index.tsx", "extensions/sadeqi-ah/weather/notchnotch.json"]), ["update"]);
});

test("a first extension from a new author says so", async () => {
  assert.deepEqual(await labels(["extensions/jane/notes/notchnotch.json"], "Jane"), ["new author", "new extension"]);
});

test("changing someone else's extension is flagged", async () => {
  assert.deepEqual(await labels(["extensions/sadeqi-ah/weather/README.md"], "jane"), ["not the author", "update"]);
});

test("scripts, workflows and odd paths count as store scripts", async () => {
  assert.deepEqual(await labels([".github/workflows/publish.yml"]), ["store scripts"]);
  assert.deepEqual(await labels(["extensions/README.md"]), ["store scripts"]);
  assert.deepEqual(await labels(["extensions/Bad_Name/x/notchnotch.json"]), ["store scripts"]);
  assert.deepEqual(await labels(["extensions/sadeqi-ah/clock/notchnotch.json", "scripts/lib.mjs"]), ["new extension", "store scripts"]);
});
