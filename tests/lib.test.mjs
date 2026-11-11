import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { compareVersions, isVersion, releaseNames, signBytes, verifyBytes } from "../scripts/lib.mjs";

test("versions compare by number, like the app", () => {
  assert.equal(compareVersions("1.10.0", "1.9.3"), 1);
  assert.equal(compareVersions("1.10", "1.10.0"), 0);
  assert.equal(compareVersions("0.6.9", "0.7"), -1);
  assert.ok(isVersion("1.2.0") && !isVersion("1.2.0-beta") && !isVersion("v1"));
});

test("release tags can't collide across handles", () => {
  assert.notEqual(releaseNames("a-b/c", "1.0").tag, releaseNames("a/b-c", "1.0").tag);
  assert.deepEqual(releaseNames("amir/focus", "1.2.0"), { tag: "amir.focus@1.2.0", asset: "focus-1.2.0.notchext" });
});

test("signatures verify only with the matching key and bytes", () => {
  const raw = (key, type, skip) => key.export({ format: "der", type }).subarray(skip).toString("base64");
  const one = generateKeyPairSync("ed25519"), two = generateKeyPairSync("ed25519");
  const seed = raw(one.privateKey, "pkcs8", 16), body = Buffer.from('{"format":1}');
  const signature = signBytes(body, seed);
  assert.ok(verifyBytes(body, signature, raw(one.publicKey, "spki", 12)));
  assert.ok(!verifyBytes(body, signature, raw(two.publicKey, "spki", 12)));
  assert.ok(!verifyBytes(Buffer.from('{"format":2}'), signature, raw(one.publicKey, "spki", 12)));
  assert.throws(() => signBytes(body, "c2hvcnQ="), /not a base64 Ed25519 seed/);
});

test("unchanged entries follow the repository to its new owner", async () => {
  const { rehome } = await import("../scripts/lib.mjs");
  const old = {
    handle: "amir/clock", manifest: { version: "1.0.0" },
    package: { url: "https://github.com/sadeqi-ah/notchnotch-extensions/releases/download/amir.clock%401.0.0/clock-1.0.0.notchext", sha256: "ab", size: 3 },
    icon: "https://raw.githubusercontent.com/sadeqi-ah/notchnotch-extensions/0123/extensions/amir/clock/assets/icon.png",
    screenshots: ["https://raw.githubusercontent.com/sadeqi-ah/notchnotch-extensions/0123/extensions/amir/clock/metadata/1.png"],
    readme: "https://example.com/notchnotch-extensions/README.md",
  };
  const moved = rehome(old, "NotchNotch/notchnotch-extensions");
  assert.equal(moved.package.url, "https://github.com/NotchNotch/notchnotch-extensions/releases/download/amir.clock%401.0.0/clock-1.0.0.notchext");
  assert.equal(moved.icon, "https://raw.githubusercontent.com/NotchNotch/notchnotch-extensions/0123/extensions/amir/clock/assets/icon.png");
  assert.equal(moved.screenshots[0], "https://raw.githubusercontent.com/NotchNotch/notchnotch-extensions/0123/extensions/amir/clock/metadata/1.png");
  assert.equal(moved.readme, old.readme, "links elsewhere stay");
  assert.equal(moved.package.sha256, "ab");
  assert.equal(old.icon.includes("sadeqi-ah"), true, "the original isn't changed");
});

test("an extension that uses a capability needs the app that first served it", async () => {
  const { minimumAppVersionFor, minimumAppVersion } = await import("../scripts/lib.mjs");
  assert.equal(minimumAppVersionFor({ permissions: [] }), minimumAppVersion);
  assert.equal(minimumAppVersionFor({ permissions: ["calendar"] }), "0.9.0");
  assert.equal(minimumAppVersionFor({ permissions: ["local-network", "now-playing"] }), "0.9.0");
});
