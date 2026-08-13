# Deployment

## GitHub Pages

1. Create a repository.
2. Push the files.
3. Settings → Pages → Source: GitHub Actions.
4. Push to `main`.
5. GitHub Actions builds `dist/` and deploys it.

## GitHub App

Create a GitHub App owned by the repository owner.

Permissions:
- Repository permissions → Contents: Read and write
- Repository permissions → Metadata: Read-only

Install the App on the target repository only.

Generate a private key.

Create a Cloudflare Worker and configure:
`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `CMS_SECRET`.

The Worker uses GitHub App JWT authentication and exchanges it for a short-lived installation token. The installation token is never returned to the browser.

## CMS

Visit `/admin/`, enter the Worker URL and CMS secret, then test the connection.

For multi-user production, do not distribute the CMS secret. Put the Worker behind an identity-aware access layer.
