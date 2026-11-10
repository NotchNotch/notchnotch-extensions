# NotchNotch Extensions

The source of every extension in the [NotchNotch](https://github.com/sadeqi-ah/notchnotch) Store.

Each extension lives in `extensions/<author>/<name>/` as source only: no built
bundles or binaries are committed. After a pull request is reviewed and merged,
CI builds the `.notchext`, uploads it to a release and publishes a signed
catalog that NotchNotch reads. The app installs a package only if it matches
the hash in that catalog.

> The Store is being built for NotchNotch 0.7. Submissions open when it ships.

## Adding an extension

1. Build and test it locally with `notchnotch dev`. See the
   [extension docs](https://github.com/sadeqi-ah/notchnotch/tree/main/docs/extensions).
2. Make sure `notchnotch check` and `notchnotch lint` pass and the manifest's
   `author` is your GitHub user name.
3. Open a pull request adding `extensions/<author>/<name>/`.

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
maintainer's.

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
