<div align="center">

<img src="apps/web/public/images/brain-mark.svg" alt="Onboarding Brain's open-book mark" width="72">

# Onboarding Brain

**Answers from the knowledge your team chooses to share.**

[Run locally](#run-locally) ·
[Workflow](#workflow) ·
[Contribute](CONTRIBUTING.md)

[![Quality](https://img.shields.io/github/actions/workflow/status/siiddhantt/onboarding-brain/ci.yml?branch=main&style=flat-square&label=quality)](https://github.com/siiddhantt/onboarding-brain/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/siiddhantt/onboarding-brain?style=flat-square)](LICENSE)

</div>

An open-source onboarding workspace powered by [Cognee](https://www.cognee.ai/).
Members ask questions and find the right people. Owners and admins choose the
knowledge the team can use.

## Features

- **Organizations** — verified accounts, invitations, and owner, admin, and
  member roles. Each organization's knowledge has its own Cognee dataset.
- **Ask** — a scrollable conversation with Markdown answers, source citations,
  and a no-answer state when supporting evidence is missing.
- **Documents** — upload PDF, DOCX, TXT, Markdown, or HTML; track indexing status,
  replace a source without changing its identity, or remove it from the brain.
- **Source connections** — organization-owned credentials and saved locations.
  Discover channels by name, reconnect, or replace credentials without restarting
  the app. Discord channels and public threads are supported today.
- **Curated imports** — preview before publishing, select individual items,
  load more, filter by date, and search loaded content or the source. Review a
  selection later to update what the team can use.
- **Directory** — departments and contacts selected from current organization
  members, so employees can find the right person when knowledge is missing.

## Workflow

1. **Set up the team.** Create an organization, invite members, and assign
   department contacts.
2. **Choose knowledge.** An owner or admin uploads a document, or connects a
   source and saves a location for reuse.
3. **Review and share.** For connected sources, preview and select useful items,
   then confirm they can be shared with the organization.
4. **Ask and maintain.** Members ask questions and inspect citations. Owners and
   admins review selections, replace documents, or remove outdated knowledge.

Published knowledge is visible to **all organization members**; original source
permissions are not inherited. Imports are reviewed snapshots: upstream edits
and deletions do not automatically change the brain. Disconnecting a connection
or forgetting a saved location leaves published knowledge intact. Removing it
from the brain never modifies the original source.

Conversations currently last for the page session, and indexing runs
synchronously. The directory provides contacts; it does not automatically route
unanswered questions.

## Run locally

You need [Node 22.22.2](.nvmrc) or a supported newer version, pnpm 10, and Docker.

```bash
git clone https://github.com/siiddhantt/onboarding-brain.git
cd onboarding-brain
pnpm bootstrap
pnpm dev
```

Open the [app](http://localhost:3000). Verification emails and invitations arrive
in the [local inbox](http://localhost:8025), not a real mailbox.

Bootstrap creates **Northstar Studio**, a fictional workspace with two accounts:

| Account              | Role                |
| -------------------- | ------------------- |
| `owner@example.com`  | Maya Chen · Owner   |
| `member@example.com` | Sam Rivera · Member |

Both use `Password123!`. These are **local demo accounts**; the owner is also a
global admin. Re-running bootstrap preserves existing credentials and settings.
Seeding makes no Cognee calls.

### Enable knowledge

Ingestion and Q&A need Cognee configured. Follow the
[Cognee setup](docs/integrations.md#cognee-knowledge-layer) for Cloud or the embedded
SDK, then restart the API. Keep credentials in the ignored environment files.
Ingestion and questions use the configured provider and may incur usage charges.

To try it, sign in as the owner and upload the
[sample expense policy](examples/northstar-expense-policy.md) under **Company
brain → Knowledge**. Once it is **Ready**, open **Ask**: “How do employees submit
an expense report, and who approves it?” Check the citation, then sign in as the
member to see the read-only knowledge and directory views.

For connected sources, follow the
[connection setup](docs/integrations.md#source-connections) and
[Discord requirements](docs/integrations.md#discord-curated-imports).

## Development

Next.js / React · NestJS / Prisma · PostgreSQL / Redis · pnpm / Turborepo

```bash
pnpm verify
pnpm build
```

```text
apps/web/         Workspace UI
apps/api/         API, database, and knowledge integrations
packages/shared/  Shared API contracts
docs/             Setup guides and architecture decisions
```

Source adapters handle provider access, discovery, and search. Shared services
handle connections, curation, and source lifecycle; the knowledge-engine adapter
handles indexing and answers. Adding another source does not require changing
the Q&A interface.

[Contributing](CONTRIBUTING.md) · [Integrations](docs/integrations.md) ·
[Architecture decisions](docs/adr/README.md) · [Troubleshooting](docs/troubleshooting.md) ·
[Local API docs](http://localhost:3001/api/docs)

## Credits & license

Built on [digohq/app-starter](https://github.com/digohq/app-starter), which provides
the authentication and multi-tenant foundation. This is an independent community
project using Cognee as its knowledge layer, not an official Cognee product.

Available under the [MIT License](LICENSE).
