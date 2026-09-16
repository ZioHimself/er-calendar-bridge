# Offboarding runbook (SYNC-18)

Manual procedure when a member stops using the bridge or you decommission a pilot container. v1.0 delivers **runbook-only** offboarding (D-24, D-25) — no automated bulk deletion of events already written to Google Calendar.

**Requirement:** SYNC-18  
**Related:** [Docker pilot](./docker-pilot.md)

---

## Overview

Offboarding stops sync, revokes credentials, and optionally preserves audit data. Propagated Google Calendar events remain until the owner removes them manually in Google Calendar (deferred bulk-delete CLI).

---

## Steps

### 1. Revoke mailbox.org CalDAV access

In mailbox.org account settings, **revoke or delete the app-specific password** used for `MAILBOX_APP_PASSWORD` / `secrets/<member>/mailbox_app_password`. This prevents further CalDAV reads with that credential.

### 2. Revoke Google third-party access (recommended)

In the member’s Google account, open **Security → Third-party access** ([Google Account permissions](https://myaccount.google.com/permissions)) and remove access for the ER Calendar Bridge OAuth client. This invalidates the refresh token (T-05-18).

You may also delete `secrets/<member>/google_refresh_token` from disk after revocation.

### 3. Stop and remove the container

From the repo directory on the host:

```bash
docker compose down bridge-operator
```

To tear down all services defined in `compose.yaml`:

```bash
docker compose down
```

Remove the container image locally only if desired (`docker rmi …`); GHCR images are shared and need not be deleted.

### 4. Optional: retain audit data (D-25)

If you need withhold audit history after removing runtime data:

```bash
cp data/operator/bridge.db ./bridge-operator-backup-$(date +%Y%m%d).db
```

Adjust path if you use `SQLITE_PATH` or a non-default DB filename under `data/<member>/`. The default layout stores `bridge.db` under the bind-mounted `DATA_DIR`.

### 5. Remove local secrets and data (destructive)

After backup (if needed):

```bash
rm -rf data/operator
rm -rf secrets/operator   # only when sure credentials are revoked
```

Use member-specific paths for multi-member stacks (`data/<member>`, `secrets/<member>/`).

---

## What v1.0 does **not** automate (D-24)

The bridge **does not** mass-delete propagated Google Calendar events on offboard. Busy blocks and full-content copies created during sync remain in the member’s Google Calendar until manually deleted or edited there.

If organisational policy requires cleanup:

1. Identify affected events in Google Calendar (by calendar, date range, or “Busy” blocks from sync).
2. Delete or adjust events manually in the Google Calendar UI.
3. Keep optional `bridge.db` backup if you need to correlate UIDs with withhold audit rows.

Future versions may add a guarded CLI for bulk delete; that is explicitly out of scope for v1.0.

---

## Traceability

| ID | Covered by |
|----|------------|
| SYNC-18 | This runbook — revoke CalDAV, stop Compose, optional DB backup, manual Google cleanup |
