# Onboarding Brain

An open-source employee onboarding Q&A app powered by
[Cognee](https://www.cognee.ai/).

Employees ask questions against their company's approved knowledge. Answers
include supporting sources; when the available evidence is insufficient, the
app does not guess. Organization owners can manage knowledge sources,
departments, and the people who may handle unanswered questions later.

## Current scope

- Multi-tenant organizations, roles, invites, and domain verification
- Organization-isolated Cognee datasets
- PDF, DOCX, TXT, Markdown, and HTML ingestion
- Grounded Q&A with citations and a no-answer state
- Department and contact configuration
- Cognee Cloud and embedded SDK adapters behind one provider-neutral interface

Expert routing and external source connectors such as Discord are not yet
implemented.

## Stack

- Next.js and React
- NestJS and Prisma
- PostgreSQL and Redis
- Turborepo with pnpm workspaces

## Run locally

Requirements: Node 22+, pnpm, and Docker.

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

The seed creates two local users:

```text
owner@example.com  / Password123!
member@example.com / Password123!
```

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

Upload [`examples/acme-expense-policy.md`](examples/acme-expense-policy.md),
then ask: “How do employees submit an expense report, and who approves it?”

The API derives the dataset from the authenticated organization. Browser
clients cannot select another dataset. See
[`docs/integrations.md`](docs/integrations.md) for the embedded SDK option and
integration details.

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
