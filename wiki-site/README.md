# OctaneRPG wiki site

Astro Starlight build of the player wiki. The markdown lives in [`../docs/wiki`](../docs/wiki); this folder only
holds the site config.

```bash
cd wiki-site
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

## Cloudflare

Deployed as a Workers static-assets project; `wrangler.jsonc` serves `dist/`.

| Setting | Value |
|---|---|
| Root directory | `wiki-site` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | 22 (`.node-version`) |

Point `wiki.octanerpg.com` at the project. Pushes to `main` redeploy.

## Writing pages

- Add a `.md` file under `docs/wiki/<section>/` with `title` frontmatter.
- Link with relative `.md` paths (`../characters/pops.md`); the build rewrites them to clean URLs.
- The first `# Heading` is dropped at build time because the page title comes from frontmatter.
- New sections need an entry in the `sidebar` in `astro.config.mjs`.
