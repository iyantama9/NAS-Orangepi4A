# API reference

The default local base URL is `http://localhost:3001`. JSON routes use `/api`; public share routes use `/s`.

## Sessions

Successful login sets the `nas_session` cookie. Browser clients should send credentials on API requests. Authentication routes include:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a user account |
| `POST` | `/api/auth/login` | Create a session |
| `POST` | `/api/auth/logout` | Revoke the current session |
| `GET` | `/api/auth/me` | Read the authenticated user |

Registration is currently public. Add an invitation or administrator policy before internet exposure.

## Nodes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/nodes` | List nodes, including folder and search views |
| `POST` | `/api/nodes/folders` | Create a folder |
| `GET` | `/api/nodes/:id` | Read node metadata |
| `PATCH` | `/api/nodes/:id` | Rename or move a node |
| `DELETE` | `/api/nodes/:id` | Move a node tree to trash |
| `POST` | `/api/nodes/:id/restore` | Restore a trashed node |
| `DELETE` | `/api/nodes/:id/purge` | Permanently purge a trashed node |

Authenticated content routes support `GET` and `HEAD`, including the standard `Range` header for partial content. Consult the route source or generated client types for the exact content path used by the current web application.

## Upload protocol

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/uploads` | Create an upload session |
| `GET` | `/api/uploads/:id` | Read upload status and accepted chunks |
| `PUT` | `/api/uploads/:id/chunks/:index` | Upload one verified chunk |
| `POST` | `/api/uploads/:id/complete` | Validate chunks and create the file node |

Chunk requests include the declared content length and SHA-256 value in `X-Chunk-Sha256`. The server rejects mismatches. The current client divides files into 8 MiB chunks and can upload multiple chunks concurrently.

Clients should retain the upload ID, query current status after reconnection, skip accepted chunks, and call completion only after every required index is present.

## Shares

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/shares` | Create a share for an owned node |
| `GET` | `/api/shares` | List shares owned by the current user |
| `DELETE` | `/api/shares/:token` | Revoke a share |
| `GET` | `/s/:token/meta` | Read public shared-item metadata |
| `GET` | `/s/:token` | Preview or download shared content |

Public share routes do not require a session. The token is the authorization secret. Expiration and revocation are evaluated by the server.

## System and health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/system` | Host, uptime, address, and storage information |
| `GET` | `/api/health` | Lightweight service health |

Protect detailed system information from unauthenticated access because host names, addresses, and storage state can help an attacker map the service.

## Validation and errors

Shared Zod schemas define core request and response contracts. Invalid input receives a client error before storage mutation. Authentication, authorization, missing resources, conflicts, and integrity failures use distinct HTTP statuses where implemented.

Clients should not retry validation, authentication, ownership, hash, or expiration failures unchanged. Retry transient network and server failures with bounded backoff. An interrupted chunk transfer is safe to retry because acceptance is bound to its upload, index, length, and content hash.
