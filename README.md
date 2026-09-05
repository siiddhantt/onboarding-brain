# Onboarding Brain

An open-source employee onboarding Q&A app powered by
[Cognee](https://www.cognee.ai/).

Employees ask questions against documents uploaded by their organization.
Answers include retrieved sources, with a no-answer state when supporting
evidence is missing. Owners and admins manage knowledge sources, departments,
and contacts.

## Current scope

- Multi-tenant organizations, roles, invites, and domain verification
- Organization-isolated Cognee datasets
- PDF, DOCX, TXT, Markdown, and HTML ingestion
- Source replacement and removal, with version and indexing status
- Curated source imports: Discord text channels and public threads, with preview and selection
- Grounded Q&A with citations and a no-answer state
- Department and contact configuration
- Cognee Cloud and embedded SDK adapters behind one provider-neutral interface

This is a community prototype. Automatic syncing, Slack, expert handoff, and
approval workflows are not implemented. Indexing runs synchronously, and
conversations are kept only in the current page session.

## Stack

- Next.js and React
- NestJS and Prisma
- PostgreSQL and Redis
- Turborepo with pnpm workspaces

## Run locally

Requirements: Node 22.22.2 (see `.nvmrc`) or a supported newer version, pnpm, and Docker.

```bash
git clone https://github.com/siiddhantt/onboarding-brain.git
cd onboarding-brain
pnpm bootstrap
pnpm dev
```

| Service           | URL                            |
| ----------------- | ------------------------------ |
| Web app           | http://localhost:3000          |
| API               | http://localhost:3001          |
| API documentation | http://localhost:3001/api/docs |
| Development inbox | http://localhost:8025          |

The seed creates **Northstar Studio**, a fictional workspace with two accounts
and contacts for People Operations and Finance. Both accounts use `Password123!`.

| Account                           | Role                      | What to try                                               |
| --------------------------------- | ------------------------- | --------------------------------------------------------- |
| `owner@example.com` — Maya Chen   | Owner; local global admin | Upload, replace, and remove sources; manage the directory |
| `member@example.com` — Sam Rivera | Member                    | Ask questions, read sources, and find department contacts |

Seeding creates missing records without resetting existing passwords or
configuration. It makes no Cognee calls. New signups and invitations use the
development inbox above.

## Connect Cognee Cloud

Add the following to `apps/api/.env`:

```bash
COGNEE_ENABLED=true
COGNEE_PROVIDER=cloud
COGNEE_CLOUD_API_URL=https://your-tenant.aws.cognee.ai
COGNEE_CLOUD_API_KEY=your-api-key
COGNEE_DATASET_PREFIX=organization
```

Never commit the API key. Environment files are ignored by Git.

Sign in as the owner and open **Northstar Studio → Company brain → Knowledge**.
Upload [`examples/northstar-expense-policy.md`](examples/northstar-expense-policy.md),
wait for **Ready**, then open **Ask** and try:
“How do employees submit an expense report, and who approves it?”

Use the source's menu to replace it with an edited copy or remove it. Sign in as
the member to check the read-only experience. Cognee ingestion and questions
use your configured account; they are not mocked.

The API derives the dataset from the authenticated organization. Browser
clients cannot select another dataset. See
[`docs/integrations.md`](docs/integrations.md) for the embedded SDK option and
integration details.

For connected sources, follow the [Discord setup](docs/integrations.md#discord-curated-imports).
Owners preview a channel or public thread in **Knowledge → Import from a connected
source**, select relevant items, and confirm organization-wide sharing. Review
the selection later to replace it; removing a source never deletes the original
messages. Unchanged imports do not trigger another indexing call.

## Verify

```bash
pnpm verify
pnpm build
```

## Project structure

```text
apps/api         NestJS API, Prisma schema, and knowledge integrations
apps/web         Next.js application
packages/shared  API contracts shared by both apps
docs/adr         Architecture decisions
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Please keep changes small,
organization-scoped, and complete across the API and UI when both are affected.

## Provenance

Built from [digohq/app-starter](https://github.com/digohq/app-starter). The
starter provides the authentication and multi-tenant SaaS foundation;
Onboarding Brain remains a separate open-source project that uses Cognee as its
knowledge layer.

## License

[MIT](LICENSE)
