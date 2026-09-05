# Integrations

Every external service Onboarding Brain talks to, what it needs, and what happens
without it.

`pnpm bootstrap` gets you a working local stack with none of the third-party
accounts below — Postgres, Redis, and Mailpit run in Docker. Everything else is
opt-in.

For who to host these with, see [providers.md](providers.md).

| Integration                               | Required?      | Without it                                               |
| ----------------------------------------- | -------------- | -------------------------------------------------------- |
| [PostgreSQL](#postgresql)                 | Yes            | The API will not start                                   |
| [Redis](#redis)                           | Yes            | Sign-in, OTP, and password reset break                   |
| [SMTP](#smtp-email)                       | For real email | Sends fail; nothing else breaks                          |
| [Mailpit](#mailpit-local-email)           | Local only     | Development email has nowhere to go                      |
| [Google OAuth](#google-oauth)             | No             | "Sign in with Google" fails; other auth is fine          |
| [Object storage](#object-storage)         | No             | Files are written to local disk                          |
| [Cognee](#cognee-knowledge-layer)         | No             | Knowledge ingestion and search are unavailable           |
| [Source connections](#source-connections) | No             | Document uploads work; connected imports are unavailable |
| [Custom domains](#custom-domains-dns)     | No             | Tenants use the main app domain                          |
| [Local HTTPS](#local-https)               | No             | Development runs over HTTP                               |

PostgreSQL and Redis are required. The API validates `DATABASE_URL`, `JWT_SECRET`,
and `REDIS_HOST` at startup; the configured services must also be reachable.

---

## Cognee knowledge layer

Cognee is optional. The company-brain page remains available without it, but
uploads and questions are disabled.

### Cognee Cloud

```bash
COGNEE_ENABLED=true
COGNEE_PROVIDER=cloud
COGNEE_CLOUD_API_URL=https://your-tenant.aws.cognee.ai
COGNEE_CLOUD_API_KEY=<your API key>
COGNEE_DATASET_PREFIX=organization
```

### Embedded TypeScript SDK

```bash
COGNEE_ENABLED=true
COGNEE_PROVIDER=embedded
COGNEE_DATASET_PREFIX=organization
OPENAI_MODEL=gpt-4o-mini
OPENAI_TOKEN=<your OpenAI API key>
```

Set these values in `apps/api/.env` and restart the API. Ingestion and questions
use the configured provider and may incur usage charges. Cognee credentials are
operator-managed; source connection credentials are managed separately per
organization. The API derives each dataset from the authenticated organization.

Official references: [Cognee Cloud API keys](https://docs.cognee.ai/cognee-cloud/ui/api-keys),
[data ingestion](https://docs.cognee.ai/cognee-cloud/functionality/data-ingestion),
and [search](https://docs.cognee.ai/api-reference/search/search).

For the adapter boundary and replacement/removal behavior, see
[ADR 0010](adr/0010-provider-neutral-knowledge-engine.md) and
[ADR 0012](adr/0012-manage-knowledge-source-lifecycle-in-the-application.md).

---

## Source connections

Each organization manages its own provider connections and saved locations in
**Company brain → Knowledge → Import from a connected source**. Credentials are
entered in the app, not shared through deployment-wide provider environment
variables. Discord is the available connector; other providers need an adapter
and their own authorization flow.

### Credential storage

Set `SOURCE_CREDENTIALS_ENCRYPTION_KEY` in `apps/api/.env` to a random 32-byte hex
key (generate one with `openssl rand -hex 32`), then restart the API. This is an
infrastructure encryption key, not a provider token. Without it, connections are
unavailable; documents and the rest of the app still work.

Credentials are encrypted with AES-256-GCM and bound to their organization and
connection. Keep the key out of Git, logs and database backups; store a secure
backup separately. All API replicas need the same key. HTTPS is required outside
local development. Do not simply replace the key: existing credentials then
cannot be decrypted. Until a re-encryption/keyring tool exists, key rotation
requires replacing each connection credential in the UI.

### Manage connections

- **Connect source** verifies access before saving a write-only credential.
  Owners/admins can rename, verify, or replace it without restarting the app;
  a failed verification leaves the existing credential unchanged.
- **Save location** keeps a collection available for future previews. It does
  not publish any content. A different provider account needs a new connection.
- **Disconnect** erases the credential and invalidates previews, but keeps saved
  locations and published knowledge. It does not revoke the provider's token.
- **Forget saved location** removes the shortcut, not its published knowledge.
  Use **Remove from brain** on the indexed source to remove that knowledge.

Connection changes invalidate earlier previews but cannot cancel an import
already accepted for indexing. See
[ADR 0013](adr/0013-organization-owned-source-connections.md) for the ownership and
lifecycle boundaries.

### Import and revise

Choose a saved location, preview, select items, and confirm organization-wide
sharing. Later, **Review selection** updates that snapshot without creating a
second source. An unchanged selection skips indexing.

- Previews call the source provider, not Cognee. They expire and are visible only
  to the requesting curator in that organization.
- **Loaded items** filters fetched content. **Search source**, when supported,
  searches the provider's index, which can lag recent changes. Date bounds use
  local days; the connector identifies whether they apply to creation or edit time.
- Selections remain visible across searches and page loads. New items are not
  automatically selected. Previously selected items outside the loaded pages are
  shown as **Saved snapshot**, not assumed deleted.
- Upstream edits/deletions need review; imports do not mirror them automatically.
  Removal clears indexed knowledge and retained text without changing the source.
  Re-adding a removed source requires explicit confirmation.

Published content is shared with **all organization members**, not just people
with access to its original location. Confirm that sharing is appropriate before
importing. See the [workflow](../README.md#workflow).

## Discord: curated imports

Use a server you administer or have permission to connect. The connector reads
text from server channels and public threads using a bot, not a personal account.
It does not post messages, download attachments, or read DMs or private threads.

1. Create and install a bot using the
   [Discord setup guide](https://docs.discord.com/developers/quick-start/getting-started).
   Enable **Message Content Intent** and grant **View Channels** and **Read
   Message History** only in approved channels. Administrator permission is not
   needed; neither are Presence or Server Members intents.
2. Choose **Connect source → Discord** in the app. Enter a name, the server ID,
   and the bot token. One server has one connection per organization; separate
   organizations manage their credentials independently. Never put tokens in
   Git, screenshots, or chat.
3. Choose **Save location** to discover readable channels by name, or save a
   public thread using its link. You only need to enter that link once. A channel
   selection does not include its child threads or future replies automatically.

Discord date searches use message creation time. The connector uses REST: no
public webhook or separate bot process is needed. Bot access is not proof of a
curator's personal Discord permissions; restrict the bot's access accordingly.

<details>
<summary>Upgrading an older environment-based Discord connection</summary>

Set the encryption key and apply migrations, then run:

```bash
pnpm --filter @app-starter/api exec ts-node scripts/migrate-discord-connection.ts
```

This retryable migration verifies the old `DISCORD_*` configuration and saves
its connection and allowlisted channels in the configured organization. Published
snapshots are unchanged. Check the UI, then remove those old fields from `.env`;
runtime code no longer reads them.

</details>

---

## PostgreSQL

The primary datastore. See [ADR 0004](adr/0004-postgresql-as-the-datastore.md).

**Where:** `apps/api/.env`

```bash
DATABASE_URL=postgresql://app_starter:app_starter@localhost:5432/app_starter?schema=public
```

**Local:** `docker compose up -d` starts it. The root `.env` sets which host
port it publishes (`POSTGRES_PORT`, default 5432).

**Hosted:** any managed Postgres works — RDS, Cloud SQL, Neon, Supabase,
Railway. Take the connection string from the provider. If it requires TLS,
append `?sslmode=require`.

**Without it:** the API exits on boot. `DATABASE_URL` is validated.

**Verify:**

```bash
pnpm --filter @app-starter/api exec prisma migrate deploy
pnpm --filter @app-starter/api exec prisma studio   # browse the data
```

---

## Redis

**Required.** Caching, rate limiting, and the short-lived keys that
authentication depends on. See
[ADR 0005](adr/0005-redis-for-cache-and-queues.md).

**Where:** `apps/api/.env`

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false        # set true for providers that require TLS
```

**What depends on it:**

- **Refresh tokens** — validity is stored in Redis, so token refresh fails
  without it and users are signed out when their access token expires
- **OTP codes** — sign-in and sign-up by one-time code
- **Password reset tokens**
- **Custom domain resolution cache**

**Local:** started by `docker compose up -d`. Host port from `REDIS_PORT` in
the root `.env` (default 6379).

**Hosted:** Upstash, Elasticache, Redis Cloud, or your platform's add-on. Set
`REDIS_TLS=true` for providers that terminate TLS, which most managed ones do.

**Inside Docker:** use the service name — `REDIS_HOST=redis`.

**Without it:** a missing `REDIS_HOST` prevents startup. An unreachable Redis
service breaks refresh, OTP sign-in, and password reset; errors are logged from
`RedisService`.

**Verify:**

```bash
docker compose exec redis redis-cli ping   # PONG
```

---

## SMTP (email)

Outbound email: verification, password reset, OTP codes, and organization
invites. Delivery is **synchronous** — a slow SMTP server holds the request
open, and a failed send is not retried. Worth changing before you have real
volume.

**Where:** `apps/api/.env`

```bash
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=noreply@onboarding-brain.local
SMTP_FROM_NAME=Onboarding Brain
```

**Local:** [Mailpit](#mailpit-local-email) catches everything, so no
credentials are needed — leave `SMTP_USER` and `SMTP_PASSWORD` blank.

**Production:** any SMTP provider — Postmark, SES, Resend, SendGrid, Mailgun.
Typically:

```bash
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<your token>
SMTP_PASSWORD=<your token>
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

Your sending domain will need SPF and DKIM records before anything reaches an
inbox. That is a provider-side setup step, not something this app configures.

**Per-tenant sender identity:** an organization can override the reply-to
address and sender name in its settings. Those override the defaults above for
mail sent on that organization's behalf.

**Without it:** sends throw and are logged. Verification and invite emails
never arrive, so those flows stall — but the rest of the app is unaffected.

**Inside Docker:** `SMTP_HOST=mailpit`.

---

## Mailpit (local email)

A fake SMTP server with a web inbox, running as one of the three containers
`docker compose` starts. It accepts every message the API sends and shows it
to you instead of delivering it — so you can click through email verification,
password reset, OTP sign-in, and organization invites without a mail provider
account, and without any risk of sending a real message to a real person.

**Where:** `docker-compose.yml`. Nothing to sign up for.

|               |                       |
| ------------- | --------------------- |
| Web inbox     | http://localhost:8025 |
| SMTP endpoint | `localhost:1025`      |

Ports come from `MAILPIT_UI_PORT` and `MAILPIT_SMTP_PORT` in the **root**
`.env` — change them there if something else already holds 8025 or 1025.

The API points at it through the ordinary SMTP settings in `apps/api/.env`:

```bash
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
```

**Typical use:** trigger a flow that sends mail — sign up, or invite someone
to an organization — then open the inbox. Messages appear immediately. The
web UI renders the HTML and plain-text parts separately, which is the quickest
way to check a template change actually looks right in both.

**Messages are not persisted.** The container has no volume, so
`docker compose down` or a restart empties the inbox. That is deliberate: it
is a scratch pad, not a record.

**Inside Docker:** if the API also runs in a container, use the service name —
`SMTP_HOST=mailpit`, port `1025`.

**Never point production at it.** Mailpit swallows mail rather than delivering
it; a deployment configured this way appears to work while every message
silently goes nowhere. Set real [SMTP](#smtp-email) credentials before you
deploy.

**Verify:**

```bash
docker compose ps mailpit          # should be healthy
open http://localhost:8025
```

## Google OAuth

"Sign in with Google", and linking a Google account to an existing user.

**Where:** `apps/api/.env`

```bash
AUTH_GOOGLE_CLIENT_ID=
AUTH_GOOGLE_CLIENT_SECRET=
AUTH_GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
```

**Getting credentials:**

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and
   create or select a project.
2. **APIs & Services → OAuth consent screen.** Pick External unless everyone
   signing in belongs to your Workspace. Fill in the app name, support email,
   and developer contact. While the app is in Testing, only accounts you add
   as test users can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   Application type: **Web application**.
4. Under **Authorised redirect URIs**, add the callback exactly as it appears
   in `AUTH_GOOGLE_CALLBACK_URL`. Add one entry per environment:
   ```
   http://localhost:3001/api/auth/google/callback
   https://api.yourdomain.com/api/auth/google/callback
   ```
5. Copy the client ID and secret into `apps/api/.env`.

**The callback points at the API, not the web app** — port 3001 in local
development, not 3000. A mismatch here is the most common failure, and Google
reports it as `redirect_uri_mismatch`. The URI must match character for
character, including scheme, port, and trailing path.

**Without it:** the app starts normally and email, password, and OTP sign-in
all work. The strategy falls back to placeholder credentials, so the Google
button is present but the flow fails at Google. Hide the button in
`components/auth/GoogleAuthButton.tsx` if you are not using it.

---

## Object storage

Avatars and organization logos. Two providers behind one interface
(`common/storage/`): local disk, and S3-compatible object storage.

**Selection order** (`common/storage/storage.module.ts`):

1. `STORAGE_PROVIDER=r2` → S3-compatible
2. `STORAGE_PROVIDER=local` → local disk
3. Otherwise, if all four `R2_*` credentials are present → S3-compatible
4. Otherwise → local disk

### Local disk

```bash
STORAGE_PROVIDER=local
UPLOADS_DIR=./uploads
APP_URL=http://localhost:3001    # how uploaded files are addressed
```

Files are served from `/uploads` by the API. Fine for development. Not fine
for anything with more than one instance, or any platform with an ephemeral
filesystem — the files disappear on redeploy.

### Cloudflare R2 (or any S3-compatible store)

```bash
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=https://cdn.yourdomain.com   # optional
R2_PUBLIC_URL_DEV=                          # optional, development only
```

**Getting credentials:**

1. Cloudflare dashboard → **R2** → **Create bucket**.
2. **R2 → Manage R2 API Tokens → Create API token.** Give it _Object Read &
   Write_, scoped to that bucket.
3. Copy the Access Key ID and Secret Access Key. The **Account ID** is in the
   R2 sidebar, not part of the token.

**Public access.** Uploaded files need to be readable by browsers. Either
enable the bucket's `r2.dev` development URL, or connect a custom domain under
**Settings → Public access** and set `R2_PUBLIC_URL` to it. Without one of
those, uploads succeed but images render broken. `R2_PUBLIC_URL` is what gets
written into the URLs the API returns; leave it unset and it falls back to
`https://<bucket>.r2.dev`.

**CORS.** Browser uploads need a CORS policy on the bucket allowing your web
origin. A starting policy is in
[`apps/api/src/common/storage/R2_CORS_CONFIG.json`](../apps/api/src/common/storage/R2_CORS_CONFIG.json)
— replace the origins with your own before applying it.

**Other S3 providers:** the provider uses the AWS SDK, so AWS S3, Backblaze
B2, MinIO, and DigitalOcean Spaces all work. The `R2_ACCOUNT_ID` is used to
build Cloudflare's endpoint URL, so pointing at another provider means
adjusting the endpoint in `r2-storage.provider.ts`.

---

## Custom domains (DNS)

Organizations can serve their public page from a domain they own. This is an
integration with **your tenant's** DNS provider rather than a service you
configure once.

This optional starter feature is visible to organization owners and admins only.
It is **not** the PRD's approved company **email** domain policy: signing up
still requires email verification and joining an existing organization requires
an invitation. Email-domain admission rules are not implemented yet.

**How it works:**

1. An admin adds a domain in organization settings. The app stores it as
   `PENDING` with a generated verification token.
2. They create a TXT record at `_app-starter-verify.<their-domain>` containing
   that token.
3. They click Verify. The API resolves the TXT record and, on a match, marks
   the domain `VERIFIED`.
4. Requests arriving on a verified domain are rewritten by
   `apps/web/src/middleware.ts` to that organization's public page.

**What you have to provide:** a way for their domain to reach your web app —
usually a CNAME to your host, plus TLS certificate provisioning for domains
you do not own. Most platforms (Vercel, Netlify, Cloudflare, Railway) have a
custom-domain API for exactly this. **The starter does not automate that
step**; it handles ownership verification and routing only.

**Env:** none. The TXT prefix is in `common/services/dns.service.ts` — change
it there and in `components/organizations/DnsConfigurationInstructions.tsx`
together, since the instructions shown to users are generated separately.

**Without it:** every tenant uses the main app domain. Nothing breaks.

---

## Analytics

None is included. The starter ships cookie consent with an **analytics**
category that defaults to off, but nothing currently reads it — wiring a
provider to that toggle is left to you.

To add one, gate initialisation on consent:

```ts
import { hasAnalyticsConsent } from '@/lib/consent';

if (hasAnalyticsConsent()) {
  // initialise your analytics client
}
```

`lib/consent/index.ts` also dispatches an `app-starter:consent-change` event
when preferences change, so you can opt in or out without a page reload.

Anything exposed to the browser must be prefixed `NEXT_PUBLIC_`, which means
it is **baked into the bundle at build time** and visible to anyone. That is
normal for a client-side analytics key; never put a secret behind that prefix.

---

## Local HTTPS

Only needed when you are testing something that requires a secure context —
cookies with `Secure`, OAuth redirects, service workers.

**Where:** `apps/api/.env`

```bash
USE_HTTPS=true
SSL_KEY_PATH=./certs/localhost-key.pem
SSL_CERT_PATH=./certs/localhost.pem
```

Generate a locally-trusted certificate with [mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkcert -install
mkcert localhost 127.0.0.1
```

Then `pnpm --filter @app-starter/api dev:https` and
`pnpm --filter @app-starter/web dev:https`.

Paths are resolved relative to the API's working directory. Never commit the
generated `.pem` files — `*.pem` is gitignored.

---

## Adding your own

Configuration is validated at startup in
[`apps/api/src/config/config.validation.ts`](../apps/api/src/config/config.validation.ts).
Add your variable there with the right `class-validator` decorators so a
misconfigured deployment fails on boot rather than at the first request.

Two conventions worth keeping:

- **Degrade rather than crash.** Every optional integration here checks
  whether it is configured and logs a warning instead of throwing. A missing
  storage bucket should not take down sign-in.
- **Document the failure mode.** The useful part of an entry above is not the
  variable name — it is what breaks when the value is wrong or absent.
