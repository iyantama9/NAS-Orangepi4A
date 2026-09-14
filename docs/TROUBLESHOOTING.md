# Troubleshooting

## Diagnostic order

1. Confirm the API process and `/api/health`.
2. Confirm PostgreSQL and the data mount.
3. Confirm owner authentication.
4. Reproduce the smallest affected file operation.
5. Inspect metadata before touching chunk files.
6. Pause cleanup when consistency is uncertain.

## Owner activation is not visible

Check `NAS_ALLOW_OWNER_BOOTSTRAP`. The activation tab appears only when the flag is `true` and the users table is empty. Restart the API after changing the environment.

If an owner already exists, activation remains unavailable by design. Use the controlled recovery procedure in [Owner access](OWNER_ACCESS.md) instead of deleting the account.

## Registration returns 403

This is expected when bootstrap is disabled or an owner exists. Confirm `GET /api/auth/registration-status`. Do not open registration on a public service to work around a lost password.

## Login succeeds but the browser returns to login

Inspect the `nas_session` cookie, browser privacy settings, host name, HTTPS, and proxy response headers. Production sets `Secure`; the browser will not send that cookie over plain HTTP. Confirm the system clock and session expiration in PostgreSQL.

## Upload does not start

Check authentication, target folder ownership, free disk space, JSON body limits for session creation, and browser console errors. Then inspect the upload initialization response.

## A chunk repeatedly fails

Compare expected index, expected length, `Content-Length`, and `X-Chunk-Sha256`. Confirm that the reverse proxy accepts at least 8 MiB plus request overhead and does not buffer or truncate the request.

## Resume does not skip completed chunks

Confirm the client retained the upload ID and that `GET /api/uploads/:id` returns accepted indexes. Check whether the upload session was already completed or removed.

## File is listed but preview or download fails

Check `/opt/nas/data` mount ownership, I/O errors, and every hash in `node_chunks`. A metadata record can remain visible when a referenced payload is absent. Pause garbage collection until the mismatch is understood.

## Media seeking fails

Inspect the `Range` request and confirm the response is `206 Partial Content` with valid content range and length headers. Disable reverse-proxy compression and buffering for file content.

## Shared link returns 404

Check token accuracy, expiration, revocation, node trash state, and payload availability. Do not log the complete share token in public support evidence.

## Storage usage looks wrong

Separate logical file bytes, folder aggregates, unique physical chunks, trash, database size, and filesystem overhead. Deduplication means logical size and physical disk use are intentionally different.

## Cleanup reports errors

Check the chunk directory structure, filesystem permissions, database connectivity, and disk health. Cleanup runs after startup and every six hours. Do not delete chunk files manually while files or upload sessions reference them.

## Database restore shows missing files

Confirm that the restored database and data directory came from the same backup window. Database-only restore can reference absent chunks. Data-only restore cannot rebuild names, hierarchy, ordering, users, or shares.

## Evidence to collect

Record the deployed commit, timestamp, route, non-secret user identifier, node or upload ID, response status, storage free space, container state, and redacted logs. Never publish passwords, session cookies, complete share tokens, or private file content.
