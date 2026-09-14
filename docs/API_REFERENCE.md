# API reference

The default local base URL is `http://localhost:3001`. JSON routes use `/api`; public share routes use `/s`.

## Sessions

Successful login sets the `nas_session` cookie. Browser clients should send credentials on API requests. Authentication routes include:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/auth/registration-status` | Report whether first-owner bootstrap is available |
| `POST` | `/api/auth/register` | Create the first owner only when bootstrap is enabled and the database is empty |
| `POST` | `/api/auth/login` | Create a session |
| `POST` | `/api/auth/logout` | Revoke the current session |
| `GET` | `/api/auth/me` | Read the authenticated user |

Registration is closed by default. It requires `NAS_ALLOW_OWNER_BOOTSTRAP=true`, and a PostgreSQL advisory transaction lock ensures only the first account can be created. Existing installations reject every registration attempt with `403`.

Registration status response:

```json
{ "available": false }
```

First-owner request during an authorized bootstrap window:

```json
{
  "email": "owner@example.com",
  "password": "<strong-owner-password>",
  "rememberMe": true
}
```

Login uses the same shape. A successful authentication response returns the owner ID and email and sets `nas_session`. Passwords are never returned.

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

`GET /api/nodes` accepts `parentId` for folder browsing, `parentId=trash` for trash, or `q` for an owner-wide name search. Search results are bounded by the server.

Create a folder:

```json
{
  "name": "Documents",
  "parentId": null
}
```

Rename or move a node with `PATCH /api/nodes/:id`:

```json
{
  "name": "Archive",
  "parentId": "<destination-folder-id>"
}
```

Authenticated content is available through `GET` and `HEAD /api/nodes/:id/content`. `Range: bytes=<start>-<end>` returns partial content when the requested range is valid.

## Upload protocol

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/uploads` | Create an upload session |
| `GET` | `/api/uploads/:id` | Read upload status and accepted chunks |
| `PUT` | `/api/uploads/:id/chunks/:index` | Upload one verified chunk |
| `POST` | `/api/uploads/:id/complete` | Validate chunks and create the file node |

Chunk requests include the declared content length and SHA-256 value in `X-Chunk-Sha256`. The server rejects mismatches. The current client divides files into 8 MiB chunks and can upload multiple chunks concurrently.

Clients should retain the upload ID, query current status after reconnection, skip accepted chunks, and call completion only after every required index is present.

Initialize an upload:

```json
{
  "filename": "archive.bin",
  "size": 16777216,
  "mime": "application/octet-stream",
  "parentId": null
}
```

The response contains `uploadId`, `chunkSize`, and `receivedChunks`. A chunk upload sends raw bytes with these headers:

```http
Content-Length: <exact-chunk-length>
X-Chunk-Sha256: <64-lowercase-hex-characters>
```

Non-final chunks must match the session chunk size. The final chunk must match the remaining file length. Completion returns `409` with missing indexes until every expected chunk is present.

## Shares

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/shares` | Create a share for an owned node |
| `GET` | `/api/shares` | List shares owned by the current user |
| `DELETE` | `/api/shares/:token` | Revoke a share |
| `GET` | `/s/:token/meta` | Read public shared-item metadata |
| `GET` | `/s/:token` | Preview or download shared content |

Public share routes do not require a session. The token is the authorization secret. Expiration and revocation are evaluated by the server.

Create a share:

```json
{
  "nodeId": "<owned-node-id>",
  "expiresInDays": 7
}
```

The response contains the token and its `urlPath`. Revoke by token, not by node ID.

## System and health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/system` | Host, uptime, address, and storage information |
| `GET` | `/api/health` | Lightweight service health |

Protect detailed system information from unauthenticated access because host names, addresses, and storage state can help an attacker map the service.

## Validation and errors

Shared Zod schemas define core request and response contracts. Invalid input receives a client error before storage mutation. Authentication, authorization, missing resources, conflicts, and integrity failures use distinct HTTP statuses where implemented.

Clients should not retry validation, authentication, ownership, hash, or expiration failures unchanged. Retry transient network and server failures with bounded backoff. An interrupted chunk transfer is safe to retry because acceptance is bound to its upload, index, length, and content hash.

| Status | Typical meaning |
| --- | --- |
| `200` | Successful read, update, action, or resumed chunk |
| `201` | Owner, folder, upload session, file, or share created |
| `206` | Valid partial-content response |
| `400` | Invalid body, name, index, range, length, or hash |
| `401` | Missing or expired owner session |
| `403` | Registration is closed |
| `404` | Resource, upload session, or public share is unavailable |
| `409` | Name conflict or incomplete upload |
| `416` | Requested byte range cannot be satisfied |
| `500` | Database or internal service failure |
