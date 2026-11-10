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

## License

Extensions in this repository are under the [MIT License](LICENSE) unless their
folder says otherwise.
