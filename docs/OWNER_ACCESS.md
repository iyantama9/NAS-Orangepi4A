# Owner access

## Policy

NAS Orange Pi 4A is a personal service with one owner account. Registration is disabled by default and is used only to bootstrap an empty database.

The control flag is:

```env
NAS_ALLOW_OWNER_BOOTSTRAP=false
```

When the flag is false, registration status reports unavailable and `POST /api/auth/register` returns `403`.

## First installation

1. Start PostgreSQL and the API with the default closed setting.
2. Confirm that the database is empty and the service is reachable only through a trusted path.
3. Set `NAS_ALLOW_OWNER_BOOTSTRAP=true`.
4. Restart the API container.
5. Open the login page and select **Aktivasi Pemilik**.
6. Create the owner account with a unique password.
7. Set `NAS_ALLOW_OWNER_BOOTSTRAP=false`.
8. Restart the API and confirm the activation tab has disappeared.

Do not leave a fresh empty installation with bootstrap enabled on a public hostname. The first successful registrant becomes the owner.

## Concurrency protection

The backend obtains a PostgreSQL transaction advisory lock before checking for an existing user and inserting the owner. Concurrent registration attempts are serialized. After the first transaction commits, every later attempt observes an existing user and is rejected.

The environment flag and database check are independent gates. An operator must enable bootstrap, and the database must contain no user.

## Sessions

Passwords are verified with Argon2. Login creates a random 32-byte base64url token stored in PostgreSQL. A remembered session expires after 30 days. A non-remembered session has a one-day server lifetime and a browser-session cookie.

Production cookies use `HttpOnly`, `Secure`, and `SameSite=Lax`. Development cookies omit `Secure` so local HTTP remains usable.

## Lost password or owner recovery

The application currently has no password-reset route. Do not delete the user to recover access because ownership and sessions reference that record.

Recovery requires an operator-controlled procedure that replaces `password_hash` with a newly generated Argon2 hash while preserving the user ID. Take a database backup first, perform recovery from a trusted shell, revoke existing sessions, and verify login before removing the backup window.

Avoid enabling public registration as a password-recovery method. An existing owner keeps registration locked, and weakening that rule would create an account takeover path.

## Verification

After setup, confirm:

- `GET /api/auth/registration-status` returns `{ "available": false }`;
- the login page does not show **Aktivasi Pemilik**;
- `POST /api/auth/register` returns `403`;
- the owner can log in and log out;
- a production login response sets a cookie with `HttpOnly`, `Secure`, and `SameSite=Lax`;
- revoked sessions no longer access protected nodes.
