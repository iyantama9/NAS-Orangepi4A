# Operations

## Host preparation

Use a maintained 64-bit Linux installation with reliable storage, Docker Engine, and Docker Compose. Keep the operating system, Docker, and firmware updated. Configure time synchronization because sessions and share expiration depend on correct time.

Create persistent directories before first deployment:

```bash
sudo install -d -m 750 /opt/nas/db /opt/nas/data /opt/nas/app
```

Set ownership to the deployment user and container identities used on the host. Do not make the data directory world writable.

## Configuration

Copy `.env.example` to `.env` and set a unique PostgreSQL password. Add `CLOUDFLARE_TUNNEL_TOKEN` only if the optional tunnel profile is used. Keep `.env` outside backups or encrypt it separately.

## Deploy with Compose

```bash
docker compose up -d --build
docker compose ps
curl --fail http://localhost:3001/api/health
```

With the optional tunnel:

```bash
docker compose --profile tunnel up -d --build
```

Cloudflare Tunnel provides transport and routing. It does not replace application authorization, secure cookie settings, registration control, backups, or host hardening.

## Device deployment helper

`infra/deploy.sh` creates an archive, transfers it over SSH, starts Compose on the device, and runs migrations. Override its target and remote directory for your environment. Confirm the host key and destination before running it.

The helper assumes network reachability through the configured SSH path, which can be provided by Tailscale. Do not publish SSH directly when a private overlay is available.

## Release verification

After deployment, verify:

1. `/api/health` responds.
2. Registration behaves according to the intended policy.
3. Login, refresh, and logout work over HTTPS.
4. A file larger than 8 MiB uploads, pauses, resumes, and downloads with the same checksum.
5. A Range request returns partial content.
6. Preview works for supported media.
7. Share creation, expiration, public download, and revocation work.
8. Trash, restore, and purge preserve unrelated files.
9. System storage figures match the mounted data device.

## Backup and restore

PostgreSQL metadata and `/opt/nas/data` must be captured as one logical set. For a small installation, stop writes or stop the application while taking both copies.

Example database export:

```bash
docker compose exec -T db pg_dump -U nas nas > nas-db.sql
```

Then snapshot or copy the data directory with metadata preserved. Store backups encrypted on a different device. Keep several generations so silent corruption or accidental purge does not replace the only good copy.

Test restore on a separate host:

1. Restore the data directory.
2. Start a clean PostgreSQL instance.
3. Import the matching database dump.
4. Start the application at the recorded commit.
5. Verify random files by checksum, folder hierarchy, shares, and login.

## Monitoring

Monitor:

- HTTP health and response latency;
- application and PostgreSQL restarts;
- data volume capacity, inode use, and I/O errors;
- database size and backup age;
- failed hash verification and upload completion;
- orphan cleanup and trash purge results;
- authentication failures and unusual share traffic;
- device temperature, memory pressure, and filesystem health.

Reserve free space for active upload chunks, database growth, and temporary operational work. A full volume can leave upload sessions incomplete.

## Upgrade

1. Record the deployed commit and back up database plus chunks.
2. Build the new image.
3. Review database migrations and storage service changes.
4. Deploy during a controlled window.
5. Run release verification.
6. Retain the old image and backup until checksum sampling succeeds.

Automatic startup migrations are forward operations. Test a downgrade separately rather than assuming an older application can read a newer schema.

## Incident playbooks

### Files are listed but do not download

Check the data mount, file permissions, disk errors, and presence of every referenced chunk. Do not run orphan cleanup until database and disk consistency are understood.

### Upload repeatedly fails

Check free space, proxy body and timeout limits, hash headers, browser logs, and application logs. Confirm that a reverse proxy accepts 8 MiB request bodies plus overhead.

### Database is unavailable

Stop write attempts, inspect PostgreSQL health and volume ownership, and restore only from a verified matching backup. The chunk volume alone cannot reconstruct user-visible paths and ordering.

### Public share is abused

Revoke the share immediately, inspect access logs, rotate any surrounding credentials, and add edge rate limits. A leaked token cannot be made secret again.

### Device storage is nearly full

Pause new uploads, verify recent backups, inspect trash and orphan metrics, then purge through supported workflows. Avoid deleting chunk files manually because shared references may still exist.
