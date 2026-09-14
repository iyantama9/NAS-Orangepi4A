# Security

## Scope

Arsiva stores user credentials, session tokens, file names, directory structure, file contents, share tokens, and host metadata. A compromise can expose or destroy the complete stored dataset.

## Current controls

- Passwords are hashed with Argon2.
- Session tokens use 32 random bytes encoded as base64url and are stored in PostgreSQL.
- Production session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Registration is disabled by default and can create only the first owner during explicit bootstrap.
- Node operations enforce authenticated ownership.
- Uploads verify declared length and SHA-256 before accepting chunk content.
- Share tokens use 32 random bytes and support expiration and revocation.
- Structured request validation uses Zod.
- File delivery supports bounded ranges instead of reading complete files into memory.

## Known gaps

- Login and the temporary owner-bootstrap route have no application-level rate limit.
- No automated security or integration test suite is configured.
- System information can reveal operational details if exposed too broadly.
- Startup migration behavior does not provide a documented rollback path.

Do not describe a public deployment as hardened until these gaps are addressed and verified in the deployed revision.

## Required public-exposure work

1. Add shared rate limits for owner bootstrap, login, public share metadata, and public downloads.
2. Put the service behind TLS with current protocols and automatic certificate renewal.
3. Keep owner bootstrap disabled except during a controlled first installation.
4. Restrict administration and detailed system information to a private network or identity-aware proxy.
5. Set request-size, concurrency, and timeout limits that still support 8 MiB chunks and Range streams.
6. Apply storage quotas and global reserve thresholds.
7. Record security-relevant actions such as login, share creation, revocation, purge, and policy changes.
8. Scan dependencies and container images during releases.
9. Test backup restoration and ransomware recovery.

## Share links

A share token is a bearer credential. Anyone who obtains the URL can access the shared target until expiration or revocation. Use short expirations, share only through trusted channels, and revoke links that are no longer needed.

Avoid placing share URLs in public analytics, referrer logs, screenshots, or support tickets. Configure the public page to prevent unintended referrer leakage when adding third-party content.

## Upload and storage safety

Do not trust browser-provided file names, content types, lengths, paths, or hashes without server validation. Preserve path traversal defenses when changing storage code. Serve user content as data with safe content disposition and type headers rather than executing it from an application origin.

Hash verification detects transmission errors and false content claims. It does not scan malware, classify sensitive data, or prove that content is safe to open.

## Sessions and passwords

Use long unique passwords. Revoke server-side sessions during logout and after password or account policy changes. Limit session lifetime according to device exposure. Protect PostgreSQL because possession of a valid stored session token can grant access.

## Host and network

- Keep SSH on a private network such as Tailscale where possible.
- Disable password SSH login after key access is verified.
- Run containers with minimum privileges and read-only filesystems where compatible.
- Restrict PostgreSQL to the private Compose network.
- Mount only the required application and data paths.
- Enable host firewall rules and automatic security updates.
- Monitor disk health and device temperature.

## Data retention and deletion

Trash and purge have different meanings. A trashed node remains recoverable until retention cleanup. Purge removes logical references, while physical chunks can remain if another node or active upload uses them. Document backup retention because deleted data can persist in snapshots and dumps.

## Reporting a vulnerability

Do not publish credentials, share links, personal files, exploit details, or deployment addresses in a public issue. Contact the repository owner privately with the affected revision, impact, reproduction steps using synthetic data, and immediate containment advice.
