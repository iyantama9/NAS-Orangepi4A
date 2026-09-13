-- Migrasi indeks performa query NAS
CREATE INDEX IF NOT EXISTS nodes_owner_parent_active_idx ON nodes(owner_id, parent_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nodes_owner_type_idx ON nodes(owner_id, type);
CREATE INDEX IF NOT EXISTS nodes_name_idx ON nodes(name);
CREATE INDEX IF NOT EXISTS node_chunks_node_id_idx ON node_chunks(node_id);
