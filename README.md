# NotchNotch Extensions

The source of every extension in the [NotchNotch](https://github.com/sadeqi-ah/notchnotch) Store.

Each extension lives in `extensions/<author>/<name>/` as source only: no built
bundles or binaries are committed. After a pull request is reviewed and merged,
CI builds the `.notchext`, uploads it to a release and publishes a signed
catalog that NotchNotch reads. The app installs a package only if it matches
the hash in that catalog.

Anyone can submit an extension. Everyone here follows the
[code of conduct](CODE_OF_CONDUCT.md).

## Adding an extension

1. Build and test it locally with `notchnotch dev`. See the
   [extension docs](https://github.com/sadeqi-ah/notchnotch/tree/main/docs/extensions).
2. Set the manifest's `author` to your GitHub user name, add a `README.md`, a
   `CHANGELOG.md` and screenshots made with `notchnotch screenshot`.
3. Run `npx notchnotch publish`. It runs the same checks as CI, copies your
   source to a fork of this repository and opens the pull request. Run it
   again after changes to update it. See
   [Publish to the Store](https://github.com/sadeqi-ah/notchnotch/blob/main/docs/extensions/publishing.md#publish-to-the-store).

You can also open the pull request by hand, adding `extensions/<author>/<name>/`.
A maintainer reviews it, usually within a week. Your first pull request is
labeled `new author`, and once it's merged you're listed in `CODEOWNERS` for
your folder, so you're asked to review anyone else's change to your extensions.

Questions and ideas go to
[Discussions](https://github.com/sadeqi-ah/notchnotch/discussions); problems
with an extension go to this repository's issues.

## What CI checks

Every pull request runs `scripts/check.mjs` on the extensions it changes:

- The folder is `extensions/<author>/<name>` in lowercase, and the manifest's
  `author` is `<author>`.
- Only source: no `node_modules/`, `dist/`, `.notchext` or compiled programs.
- No `build.mjs` and no native `helpers/` yet. Store extensions use the
  standard build, and helpers will be built from source by CI in a later
  version.
- The `id` is unique and never changes. An update has a higher numeric version.
- Dependencies install without running install scripts, TypeScript passes,
  `notchnotch build` passes the app's install checks, and `notchnotch lint`
  finds no Store guideline issues.

## What review looks at

CI can't judge these, so a maintainer does:

- **It does what it says.** The title, description, icon and screenshots match
  what it does.
- **It asks for no more than it needs.** Every website in `network` and
  `imageHosts`, every connection and every setting has a reason, which the
  README gives.
- **No surprises.** No tracking or analytics, no sending data to sites the user
  wouldn't expect, no obfuscated or minified source, no remote code.
- **It fits in the notch.** It's useful at a glance, works in light and dark,
  and handles being offline or not set up.
- **It's yours to publish.** You wrote it or have the right to, and it doesn't
  copy another product's name, icon or look.

Changes to someone else's extension need that author's approval as well as a
maintainer's. `.github/CODEOWNERS` lists each author for their own folder.

## Labels

The **Labels** workflow labels every pull request by what it changes, so
review starts from the right questions:

| Label | Means |
| --- | --- |
| `new extension` | Adds an extension the Store doesn't have |
| `update` | Changes an extension that is already in the Store |
| `new author` | First folder for this author: a maintainer adds them to CODEOWNERS before merging |
| `not the author` | Changes an extension in someone else's folder |
| `store scripts` | Changes CI, scripts or tests |
| `needs changes` | Set by a reviewer: waiting for the author |

It runs from the base branch and reads only the pull request's file list, so
it never runs code from the pull request.

## Merging

`main` is protected: every change arrives as a pull request, the **Check**
workflow must pass, a code owner must approve, and review conversations must be
resolved. Pushing new commits dismisses earlier approvals. Nobody can force-push
to or delete `main`.

Merging to `main` is what publishes to the Store, so these rules are the
Store's review. The `catalog` branch isn't protected the same way: the app
accepts only a catalog signed with the key in `catalog-public-key`.

## How publishing works

When a pull request is merged, the **Publish** workflow:

1. builds a `.notchext` for each extension whose version isn't in the Store
   yet, in a job with no secrets;
2. uploads each one to a release tagged `<author>.<name>@<version>`;
3. writes `index.json` with every extension's manifest and package hash, signs
   it, and pushes both to the `catalog` branch.

It also re-signs the catalog every week, because NotchNotch rejects one older
than 30 days. The format is described in
[the NotchNotch docs](https://github.com/sadeqi-ah/notchnotch/blob/main/docs/internals/store-catalog.md).

## License

Extensions in this repository are under the [MIT License](LICENSE) unless their
folder says otherwise.
