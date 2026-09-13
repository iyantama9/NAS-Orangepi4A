#!/usr/bin/env bash
# Deploy: kirim source ke Pi (tar+scp, tanpa perlu rsync) lalu docker compose up.
set -euo pipefail
PI=${PI:-root@100.82.5.51}
REMOTE=/opt/nas/app

[ -f .env ] || { echo "Buat .env dulu (lihat .env.example)"; exit 1; }

ssh "$PI" "mkdir -p $REMOTE /opt/nas/data/chunks /opt/nas/db"
tar czf /tmp/nas-deploy.tgz --exclude=node_modules --exclude=dist --exclude=.env \
  --exclude='.git' --exclude='.claude' package.json pnpm-workspace.yaml tsconfig.base.json \
  .npmrc Dockerfile docker-compose.yml packages apps infra
scp -q /tmp/nas-deploy.tgz "$PI:/tmp/"
ssh "$PI" "cd $REMOTE && tar xzf /tmp/nas-deploy.tgz && rm /tmp/nas-deploy.tgz"
scp -q .env "$PI:$REMOTE/.env"

ssh "$PI" "cd $REMOTE && docker compose up -d --build && sleep 2 && docker compose exec -T api node dist/migrate.js"
echo "Selesai. Buka http://100.82.5.51:3001"
