<div align="center">
  <img src="../../public/icon.png" alt="CF-Navs project icon" width="112" height="112">
  <h1>CF-Navs</h1>
  <p><strong>Bring your everyday websites, work tools, and private bookmarks into your own start page.</strong></p>
  <p>Run on Cloudflare Workers without maintaining a server. Import your existing bookmarks, choose a theme, and open the same navigation space on desktop and mobile.</p>

  <p>
    <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
    <img src="https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white" alt="Svelte 5">
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5">
    <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-2563EB" alt="Apache License 2.0"></a>
  </p>

  <p>
    <a href="#features">Features</a> ·
    <a href="#screenshots">Screenshots</a> ·
    <a href="#quick-deployment">Quick deployment</a> ·
    <a href="#local-development">Local development</a> ·
    <a href="../../docs/README.md">Project docs</a>
  </p>

  <a href="https://github.com/lbjxr/CF-Navs/fork">
    <img src="https://img.shields.io/badge/Fork_on_GitHub-181717?logo=github&logoColor=white" alt="Fork on GitHub">
  </a>
</div>

**Languages:** [简体中文](../../README.md)

---

## Features

**Keep a large collection easy to find, organize, and use.** CF-Navs combines two-level categories, site-wide search, bulk organization, and data backups in one place. Use it as a personal start page, a work toolbox, or a public resource directory. Visitors can browse public content while administrators manage the complete collection after signing in, without maintaining a separate site for private links.

| | Capability | Description |
|---|---|---|
| ☁️ | Edge full stack | Workers, D1, and KV host the entire application, while the code and data remain in your own GitHub / Cloudflare accounts without renting a VPS or maintaining a database service |
| 🧭 | Navigation home | Clear top-level groups and second-level categories, with search across titles, URLs, descriptions, and full category paths; side, top, and mobile navigation adapt to different screens, and top navigation can wrap across lines |
| 🏠 | Home settings | Configure the site title, search box, search engine selector, and number of frequently visited links, with a live preview before saving; signed-in administrators can create top-level and nested categories directly from the home page |
| 🛠️ | Administration | Edit, move, reorder, and protect categories from accidental deletion, while full paths and bulk bookmark moves reduce one-by-one editing; site, layout, search, backup, and account security settings are managed together |
| 🔒 | Private bookmarks | Mark a bookmark as a private link visible only to signed-in users when creating or editing it; public visitors never receive private bookmark data, while administrators can browse and manage it normally |
| 🗂️ | Private categories | Mark a category as hidden from visitors; the category, its children, and their bookmarks remain available to administrators but are not sent to public visitors |
| ↕️ | Cross-category sorting | Move bookmarks between top-level, second-level, and empty categories and adjust their order; use drag and drop on desktop or a move-to-category control on mobile, then save or cancel the whole session together |
| 🔄 | Browser bookmark sync | Enable one-way synchronization in the administration panel; the Chrome/Edge extension puts newly added browser bookmarks into `Browser New Bookmarks` without changing existing categories or deleting navigation bookmarks |
| 📊 | Usage analytics | Homepage bookmark clicks are counted, while the administration panel provides total clicks, visited/unvisited counts, a Top 20 most-visited ranking, and a paginated list of never-visited bookmarks; analytics refreshes when the page opens |
| 🎨 | Appearance customization | 22 built-in themes, light/dark modes, backgrounds, and accent colors, with separate category font sizes and icon sizes for top-level and second-level categories; customize card dimensions, opacity, and footer HTML / CSS / JavaScript, with isolated previews for CSS and footer code |
| 🔎 | Search and icons | Site-wide grouped search, configurable external search engines, bookmark favicons / Iconify icons, and image, text, or emoji icons for categories |
| 💾 | Data migration | Export complete backups or selected categories, optionally including site settings; restore JSON by appending or replacing data, with compatibility for Sun-Panel data and browser bookmark HTML |
| 🔐 | Secure authentication | PBKDF2 password hashing, bearer session tokens, CSP, authenticated administrator APIs, and login-failure rate limiting; private icons use authorization checks and cache isolation |
| ⚡ | Loading optimization | Code splitting, edge caching, local snapshots, lazy icon loading, and a basic PWA offline fallback; direct navigation to administration pages does not flash the homepage first |

Prefer compact layouts? Desktop detail cards can be as narrow as **40 px**, while mobile keeps a **150 px** safety minimum. Very narrow cards compress titles and descriptions and work best for icon-first navigation.

### Bookmark privacy and cross-category sorting

- **Organize directly from the homepage**: after signing in, create a top-level category or a child category under the current group; the new category is selected automatically. When editing a bookmark, the category selector expands and focuses the current category to reduce repeated searching.
- **Private links**: administrators can check “Make private (visible only after sign-in)” when creating or editing a bookmark. Public data APIs filter these bookmarks for signed-out visitors, while signed-in administrators can still view, edit, and delete them from the homepage and administration panel.
- **Private categories**: administrators can check “Hidden from visitors (visible only after sign-in)” when editing a category. Signed-out visitors receive none of the category, its children, or their bookmark data; administrators can continue to view and manage them. Existing categories remain visible to visitors by default.
- **Cross-category drag and drop**: after signing in, click “Sort” in any homepage category to enter one sorting session. On desktop, drag bookmarks into top-level, second-level, or empty categories and adjust their positions; on mobile, choose a target through “Move to category”. Click “Save sorting” to save categories and order together, or “Cancel” to discard the changes.
- **Bulk moves**: when many bookmarks need to be recategorized, filter and select them in the administration panel, choose a target category, and confirm its full path to move them in one operation without opening each editor.
- **Browser bookmark sync**: enable “Browser bookmark sync” under “Settings → Site settings” to create a `Browser New Bookmarks` category automatically. Install and sign in to the Chrome/Edge extension in [`browser-extension`](../../browser-extension/) to sync subsequently added browser bookmarks into that category, using `https://favicon.im/<hostname>?larger=true` as the default icon candidate. The extension does not recreate browser bookmark folders as navigation categories; it only performs one-way new-bookmark sync from the browser to the navigation page, never deletes or overwrites existing navigation bookmarks, and lets you organize synced items later in homepage sorting mode.

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Light homepage</strong><br>
      <img src="../../docs/screenshots/cf-navs-light.webp" alt="CF-Navs light homepage with diagonal contrast and frosted glass">
    </td>
    <td align="center" width="50%">
      <strong>Dark homepage</strong><br>
      <img src="../../docs/screenshots/cf-navs-dark.webp" alt="CF-Navs dark homepage with diagonal contrast and frosted glass">
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <strong>Light mobile homepage</strong><br>
      <img src="../../docs/screenshots/cf-navs-light-mobile.webp" alt="CF-Navs light mobile homepage" width="260">
    </td>
    <td align="center" width="50%">
      <strong>Dark mobile homepage</strong><br>
      <img src="../../docs/screenshots/cf-navs-dark-mobile.webp" alt="CF-Navs dark mobile homepage" width="260">
    </td>
  </tr>
</table>

<p align="center">
  <strong>Theme and site settings</strong><br>
  <img src="../../docs/screenshots/cf-navs-admin-setting.webp" alt="CF-Navs theme and site settings">
</p>

More screenshots are available in [`docs/screenshots`](../../docs/screenshots).

## Quick deployment

**Do not want to maintain a server? Start with the dashboard deployment.** Prepare GitHub and Cloudflare accounts, then follow “Fork → connect the repository → set the setup token → initialize in the browser”. A normal installation does not require manually running SQL or entering a Cloudflare API token.

You can start with the Cloudflare Free plan, but the free quotas are not unlimited; requests, database operations, and KV operations each have limits. See the official [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), and [KV](https://developers.cloudflare.com/kv/platform/pricing/) pricing pages for details.

For a first installation, complete one deployment method from beginning to end instead of mixing both. Both methods eventually initialize the database and administrator account through `/install`.

CF-Navs requires these Cloudflare resources:

| Resource | Binding | Purpose |
|---|---|---|
| D1 Database | `DB` | Stores settings, categories, and bookmarks |
| KV Namespace | `SESSION` | Login rate limiting, click rate limiting, and the session revocation list |
| Secret | `SETUP_TOKEN` | Manually configured authorization for the first installation |

### Method 1: Cloudflare dashboard deployment (recommended)

This method suits users who want to work entirely in a browser without installing local tools. After Cloudflare connects your GitHub fork, it automatically builds and deploys from the `main` production branch; update that branch when syncing upstream changes later.

#### Step 1: Fork this repository

[![Fork on GitHub](https://img.shields.io/badge/Fork-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/lbjxr/CF-Navs/fork)

Click **“Fork on GitHub”** above and give the project a ⭐ Star!

#### Step 2: Deploy to Cloudflare Workers

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/workers-and-pages)

Click the button above to open Cloudflare, choose to connect to GitHub, authorize it, and select the fork you just created.

<img width="1600" height="1000" alt="Select project" src="../../docs/screenshots/cf-deploy-select-repo.webp">

After clicking **Start setup**, confirm the following build settings and leave the rest at their defaults:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- The production branch `main`, root directory `/`, and Node.js environment are detected from [`wrangler.toml`](../../wrangler.toml). To specify a Node.js version, set `NODE_VERSION=24` in **Build variables** ([official documentation](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)).

<img width="1600" height="1000" alt="Build settings" src="../../docs/screenshots/cf-deploy-build-settings.webp">

#### Step 3: Save and complete the first production deployment

Save the configuration and complete the first **Production** deployment. Cloudflare should create and bind the `DB` D1 database and `SESSION` KV namespace from [`wrangler.toml`](../../wrangler.toml).

After the first deployment, verify both bindings. If you see a missing binding or a resource-creation permission error, confirm that the deployment is from the `main` **Production** environment and that Cloudflare is using the correct account, then read [Troubleshooting](../../docs/guides/TROUBLESHOOTING.md). Do not repeatedly create databases or KV namespaces without confirming the account and resources first.

#### Step 4: Configure the `SETUP_TOKEN` secret

After the first production deployment, open **Settings → Variables and Secrets**, select the **Production** environment, and configure `SETUP_TOKEN`:

- If Cloudflare has already generated a `SETUP_TOKEN`, edit it and replace it with a value you have saved, then run **Clear cache** once under **Settings → Builds**.
- If the existing value is a plain text variable rather than a secret, delete it and add `SETUP_TOKEN` again as a **Secret**. Do not keep a plain variable and a secret with the same name.
- If `SETUP_TOKEN` is not listed, add it manually as a **Secret**. Use a sufficiently long random value and never add it as a plain text variable.

<img src="../../docs/screenshots/cf-deploy3.jpg" alt="Cloudflare dashboard variables and secrets example">

#### Step 5: Redeploy so the secret takes effect

After saving the secret, redeploy the same `main` production deployment. On the **Deployments** page, retry or redeploy the latest production deployment, or push a new commit to `main`. Do not visit `/install` immediately after saving the secret; a new deployment must read the secret first.

#### Step 6: Open `/install` and complete setup

Open the deployed Workers URL and visit `/install`. Enter the `SETUP_TOKEN` configured for the current production environment, then create the administrator username and password. After installation and login succeed, delete or rotate the token. A completed site no longer needs it, whether Cloudflare generated it automatically or you added it yourself.

A custom domain is optional. Add and enable it under **Domains & Routes**, verify that it works and supports login, and only then consider disabling the `workers.dev` address. If you are not ready to use a custom domain, keep the Workers URL as an access entry point.

### Method 2: Wrangler CLI deployment

Prerequisites: Node.js **22.12+ (22.x) or 24+**, npm, and a Cloudflare account. Node.js 24 LTS is recommended. All resource commands use the account currently authenticated in Wrangler; if you have multiple Cloudflare accounts, run `npx wrangler whoami` first to verify the account.

```bash
git clone https://github.com/lbjxr/CF-Navs.git
cd CF-Navs
git switch develop
npm install

npx wrangler login
npx wrangler whoami

# Run each create command only when the resource does not already exist.
npx wrangler d1 create cf-navs-db
npx wrangler kv namespace create SESSION

npm run setup:wrangler
npm run deploy                 # First deployment creates the Worker.
npx wrangler secret put SETUP_TOKEN
npm run deploy                 # Redeploy so the secret takes effect.
```

If the D1 database or KV namespace already exists, do not run the `create` command again. First use `npx wrangler d1 list` and `npx wrangler kv namespace list` to inspect the resources in the current account, then run `npm run setup:wrangler`. The D1 database name should be `cf-navs-db`, and the Worker's KV binding must be named `SESSION`.

`npm run setup:wrangler` writes real resource IDs to the Git-ignored `wrangler.local.toml`. After deployment, visit `/install`; the installer initializes the database schema and creates the administrator. Do not run `wrangler secret put` before the first deployment because the Worker does not exist yet.

Normal installation does not require manual SQL. Only use [`schema.sql`](../../schema.sql) or `npm run db:init:remote` to recover when the installer reports a schema initialization failure.

### Post-deployment checks for both methods

- `/install` opens and accepts `SETUP_TOKEN` to complete initialization.
- You can sign in to the administration panel with the new administrator account.
- Categories and bookmarks can be saved, and the data persists after a refresh.
- If the page still shows an older version, force-refresh the page so the new Service Worker takes over.
- If installation or binding fails, inspect the Worker logs with `npx wrangler tail`. Before running any command that affects production data, confirm the current Cloudflare account and target Worker.

**Make the navigation page useful immediately**: import an existing bookmark collection in the administration panel, choose a theme, hide the categories or links that need privacy, and set the page as your browser start page. The browser extension can collect new bookmarks, while homepage sorting and bulk moves keep the collection organized.

For more configuration and troubleshooting information, see the following guides. Follow this page for the deployment branch and Node.js requirements:

- [Quick start](../../docs/guides/QUICKSTART.md)
- [Complete deployment guide](../../docs/guides/DEPLOYMENT.md)
- [Troubleshooting](../../docs/guides/TROUBLESHOOTING.md)

## Local development

The development environment uses Node.js 22.12+ (22.x) or 24+; Node.js 24 LTS is recommended to match CI.

Install dependencies:

```bash
npm install
```

Start the Worker and frontend development servers separately:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:web
```

The frontend is available at `http://localhost:5173` by default.

Common checks:

```bash
npm run type-check
npm test
npm run build
git diff --check
```

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | Svelte 5, TypeScript, Vite 7 |
| Worker API | Hono, Cloudflare Workers |
| Data and sessions | Cloudflare D1, Cloudflare KV |
| Interaction and sorting | SortableJS |
| Testing | Vitest 4, Svelte Check, real Chrome regression scripts |

## Project structure

```text
CF-Navs/
├── src/                 # Svelte pages, components, and browser-side logic
├── worker/              # Worker routes, middleware, and D1 data access
├── shared/              # Shared frontend/backend types and settings contracts
├── public/              # Icons, PWA assets, and other static resources
├── browser-extension/   # Chrome/Edge extension for syncing new browser bookmarks
├── tests/               # Vitest unit and regression tests
├── docs/                # User guides, technical references, and screenshots
├── scripts/             # Development, deployment, and audit scripts
├── schema.sql           # D1 database schema
└── wrangler.toml        # Public Cloudflare Worker configuration
```

See the [project documentation index](../../docs/README.md) for architecture, API, and performance contracts.

## Environment configuration

| Name | Type | Required | Description |
|---|---|---|---|
| `DB` | D1 binding | Yes | Database binding |
| `SESSION` | KV binding | Yes | Storage for login/click rate limiting and the session revocation list |
| `SETUP_TOKEN` | Secret | First installation | Authorizes `/install`; delete or rotate it after installation |
| `SESSION_TTL` | Variable | No | Session lifetime; `wrangler.toml` defaults to `2592000` seconds (30 days), while the Worker falls back to 7 days when it is unset |
| `INIT_ADMIN_USER` | Variable | No | Only for legacy database upgrades or credential recovery |
| `INIT_ADMIN_PASSWORD` | Secret | No | Only for legacy database upgrades or credential recovery |
| `RESET_ADMIN_CREDENTIALS` | Variable | No | One-time marker for forcing credential reset on a legacy database |

Do not write real resource IDs, passwords, tokens, or other secrets into the repository.

## Data import

You do not need to enter existing bookmarks again. The administration panel supports these formats:

- **CF-Navs JSON backup**: export all data or selected categories, preserve the two-level category relationship, optionally include site settings, and restore by merging along full paths or replacing the data.
- **Sun-Panel data**: import categories at the top level and convert bookmarks and compatible icon fields so an existing navigation collection can be migrated without starting over.
- **Browser bookmark HTML**: import the standard file exported by a browser; valid folders map to two-level categories, and deeper paths are flattened into second-level titles.

**Move only what you need**: export a top-level category with its children or select an individual second-level category. The system fills in required parent records without including bookmarks from unselected categories. This is useful for moving a group of work resources to another CF-Navs instance or keeping a focused backup.

Back up existing data before importing: **append mode keeps duplicate links, while replace mode replaces all categories and bookmarks**. Partial export is a backup and migration capability, not automatic deduplication or bidirectional synchronization. Backups may contain private links and site settings, so store them carefully.

See [Sun-Panel data import](../../docs/guides/SUNPANEL_IMPORT.md) and [browser bookmark import](../../docs/guides/BROWSER_BOOKMARK_IMPORT.md).

## Contributing

Open an Issue to report an experience or submit a Pull Request with an improvement. Read [Contributing](../../CONTRIBUTING.md) first and complete the checks required for the scope of your change. For security issues, use the [private reporting channel](../../SECURITY.md) instead of posting credentials or private bookmarks in a public Issue.

## Acknowledgements

The project was influenced by the design ideas of [Sun-Panel](https://github.com/hslr-s/sun-panel), and parts of the icon-fetching logic were inspired by [iori-nav](https://github.com/jy02739244/iori-nav).

## Star History

<a href="https://www.star-history.com/?repos=lbjxr%2FCF-Navs&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=lbjxr/CF-Navs&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=lbjxr/CF-Navs&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=lbjxr/CF-Navs&type=date&legend=top-left" />
 </picture>
</a>

## License

This project is licensed under the [Apache License 2.0](../../LICENSE). Attribution information is available in [`NOTICE`](../../NOTICE).

### Fork and attribution notice

If you fork, redistribute, or publish a modified version based on CF-Navs:

- Keep `LICENSE`, `NOTICE`, and the copyright, license, and attribution notices already present in source files.
- Under Apache License 2.0, keep clear modification notices in files you have changed.
- State clearly in the README or product documentation that the project is based on CF-Navs and link to the upstream repository. Do not imply that a modified version is officially published or endorsed by the original authors.

These notes help users identify derivative versions; the [LICENSE](../../LICENSE) controls the specific rights and obligations.

<!-- Afdian sponsorship section (collapsible) -->
<hr>

<div align="center">

<details>
  <summary><b>☕️ Like CF-Navs? Buy the author a coffee / Sponsor</b></summary>
  <br>
  <p>If this project helps you, consider sponsoring it. Your support helps keep the project maintained and updated ❤️</p>
  <a href="https://afdian.com/a/benjian" target="_blank">
    <img src="https://img.shields.io/badge/Afdian-Sponsor-946CE6?style=for-the-badge&logo=afdian&logoColor=white" alt="Afdian sponsorship">
  </a>
  <p><small>💡 Sponsorship includes setup guidance; see the Afdian homepage for details.</small></p>
</details>

</div>
