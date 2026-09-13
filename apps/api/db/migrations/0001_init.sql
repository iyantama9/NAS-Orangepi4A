-- Skema awal NAS.
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY, -- token acak, disimpan di cookie httpOnly
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- Pohon file/folder a-la Google Drive; deleted_at != NULL berarti ada di trash.
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('FILE', 'FOLDER')),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  size BIGINT NOT NULL DEFAULT 0,      -- file: byte; folder: agregat turunan
  mime TEXT,
  head_sha256 TEXT,                    -- sha256 keseluruhan file (integritas)
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nodes_owner_parent_idx ON nodes(owner_id, parent_id);
CREATE INDEX nodes_deleted_idx ON nodes(deleted_at) WHERE deleted_at IS NOT NULL;

-- Urutan chunk pembentuk sebuah file (chunk itu sendiri content-addressed di disk).
CREATE TABLE node_chunks (
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  chunk_sha256 TEXT NOT NULL,
  PRIMARY KEY (node_id, idx)
);

CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_parent_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime TEXT,
  chunk_size INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE upload_session_chunks (
  session_id UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  chunk_sha256 TEXT NOT NULL,
  PRIMARY KEY (session_id, idx)
);

CREATE TABLE share_links (
  token TEXT PRIMARY KEY,              -- random 32 byte base64url
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
