# CryptoNews CMS — Production V1

A Git-backed news CMS designed for GitHub Pages with a secure serverless publishing boundary.

## Architecture

- Public website: static HTML generated from Markdown.
- Content: Markdown + frontmatter in Git.
- CMS: `/admin/`.
- Publishing: Cloudflare Worker endpoint (recommended) using a GitHub App installation token.
- Hosting: GitHub Pages for the public site.
- CI/CD: GitHub Actions.
- No GitHub PAT is required in the browser in production mode.

## Important deployment order

### 1. Public site
Push this repository to GitHub and enable Pages using the GitHub Actions workflow.

### 2. CMS backend
Deploy `functions/worker.js` to Cloudflare Workers (or adapt it to another serverless platform).

Set these Worker secrets/variables:
- `CMS_SECRET`: a long random secret used to authenticate the CMS.
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (usually `main`)

The GitHub App should be installed ONLY on this repository and should receive only:
- Contents: Read and write
- Metadata: Read

Do not grant administration, Actions administration, organization administration, or unrelated repository permissions.

### 3. Configure CMS
Open `/admin/` and set the Worker API URL and CMS secret. The secret is kept in session memory only and is never committed.

## Local build

Node 20+:
`npm install`
`npm run build`

The build output is `dist/`.

## Production notes

GitHub Pages is the delivery layer. The CMS publishing endpoint is deliberately separated from the public static site. This avoids exposing a GitHub credential to every CMS browser session.

For multi-editor access, put the Worker behind an identity provider (Cloudflare Access, Google Workspace, GitHub OAuth, or your organization's SSO) and keep CMS_SECRET server-side. Do not share a GitHub App private key with editors.

See `SECURITY.md` and `DEPLOYMENT.md`.
