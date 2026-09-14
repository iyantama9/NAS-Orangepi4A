# Data model

## Storage domains

The system has two persistence domains that form one logical dataset:

| Domain | Location | Contains |
| --- | --- | --- |
| Metadata | PostgreSQL | Owner, sessions, file tree, chunk order, uploads, and shares |
| Payload | `NAS_DATA_DIR` | Content-addressed chunk bytes |

Neither side is a complete backup on its own.

## Tables

| Table | Purpose | Key relationships |
| --- | --- | --- |
| `users` | Personal owner identity and password hash | Parent of sessions, nodes, uploads, and shares |
| `sessions` | Server-side login sessions | Deleted when the owner is removed |
| `nodes` | File and folder tree | Self-referencing parent and owner |
| `node_chunks` | Ordered chunk hashes for a file | Deleted with its node |
| `upload_sessions` | Incomplete upload metadata | Owner and optional destination folder |
| `upload_session_chunks` | Chunks accepted for an upload | Deleted when its upload session completes |
| `share_links` | Public bearer tokens and expiration | Deleted with the owner or shared node |
| `schema_migrations` | Applied migration names | Controls startup migration order |

## Logical files

A file node stores size, media type, creation time, and a head hash derived from its ordered chunk hashes. `node_chunks` records which content chunks compose the file and their order. The actual bytes live on disk under the chunk hash.

Files with identical chunks reuse the same disk content. Deleting one file removes its references but must not remove a chunk still referenced by another file or active upload.

## Folder sizes

Folder size is maintained as an aggregate of descendants. Creating, trashing, restoring, or moving nodes updates ancestor totals. Operational checks should compare aggregate size with referenced file sizes when a mismatch is suspected.

## Trash and purge

Trash sets `deleted_at` on a node tree. Restore clears the marker and repairs visibility when a parent remains trashed. Permanent purge deletes the logical node only after it is in trash. Background collection later removes unreferenced chunks.

The current trash retention is 30 days. Cleanup runs shortly after startup and then every six hours.

## Upload sessions

An upload session records file name, total size, target folder, media type, and chunk size. Each accepted index references a verified SHA-256 hash. Completion requires every expected index, creates the file and its ordered references, then deletes the upload session.

Incomplete sessions preserve resume state. Operators should define how long abandoned sessions may remain because their chunks count as active references for garbage collection.

## Share links

A share token is the primary key and bearer credential. It references one node, records the creating owner, and can have an expiration time. Revocation deletes the token record.

## Indexes

Indexes support owner and parent browsing, active-node queries, node type, node name, session ownership, and file chunk lookup. Search currently relies on case-insensitive name matching and returns a bounded result set.

## Backup consistency

For a small personal deployment, stop writes while backing up PostgreSQL and the data directory. Record the application commit and migration state with the backup. During restore, load the matching pair and verify file checksums before enabling cleanup jobs.
