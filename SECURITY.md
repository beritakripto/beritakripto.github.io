# Security model

This repository is designed so that the public site has no write credentials.

## Browser
The CMS sends authenticated publishing requests to the Worker. It does not receive the GitHub App private key or installation token.

The CMS secret is held in session memory only. It is not stored in localStorage, cookies, URLs, article files, or Git.

## Worker
The Worker validates the CMS secret, applies request-size limits, validates paths and frontmatter, and creates/updates files through the GitHub API.

For a serious multi-user newsroom, add an identity provider in front of the Worker and use per-user roles.

## GitHub App
Restrict the App to one repository. Grant only Contents read/write and Metadata read.

Rotate the App private key and CMS secret if exposed.

## Content safety
The editor stores article body as Markdown. The static build sanitizes/filters HTML rather than injecting arbitrary editor markup into document templates. JSON-LD values are JSON encoded and HTML-safe.

## Operational security
- Enable 2FA on GitHub.
- Protect the `main` branch.
- Require pull requests if multiple people publish.
- Enable Dependabot.
- Review GitHub Actions permissions.
- Keep production secrets out of Git.
