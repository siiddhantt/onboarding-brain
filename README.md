<div align="center">

<img src="apps/web/public/images/brain-mark.svg" alt="Onboarding Brain's open-book mark" width="72">

# Onboarding Brain

**Answers from the knowledge your team chooses to share.**

[Run locally](#run-locally) ·
[Try the brain](#try-the-brain) ·
[Contribute](CONTRIBUTING.md)

[![Quality](https://img.shields.io/github/actions/workflow/status/siiddhantt/onboarding-brain/ci.yml?branch=main&style=flat-square&label=quality)](https://github.com/siiddhantt/onboarding-brain/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/siiddhantt/onboarding-brain?style=flat-square)](LICENSE)

</div>

An open-source onboarding workspace powered by [Cognee](https://www.cognee.ai/).
Members ask questions and find the right people. Owners and admins choose the
knowledge the team can use.

## One workspace, three places

- **Ask** — questions in plain language, answers with sources, and a no-answer
  state when supporting evidence is missing.
- **Knowledge** — upload documents or select messages from Discord channels and
  public threads. Save organization-owned connections and locations; preview
  before sharing, then replace or remove sources as needed.
- **Directory** — departments and contacts drawn from the organization's members.

Each organization has its own Cognee dataset. Imported content is shared with
everyone in that organization; original channel permissions are not carried over.
Imports are reviewed snapshots, not automatic mirrors of the source.

This is a **community prototype**. Slack, automatic expert handoff, approval
workflows, and company email-domain admission are not implemented. Indexing is
synchronous, and conversations last only for the current page session.

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

## Try the brain

Ingestion and Q&A need Cognee configured. Follow the
[Cognee setup](docs/integrations.md#cognee-knowledge-layer) for Cloud or the embedded
SDK, then restart the API. Keep credentials in the ignored environment files.
Ingestion and questions use the configured provider and may incur usage charges.

1. Sign in as the owner. Open **Northstar Studio → Company brain → Knowledge**
   and upload the [sample expense policy](examples/northstar-expense-policy.md).
2. Wait for **Ready**, then open **Ask**: “How do employees submit an expense
   report, and who approves it?” Open the cited source to check the answer.
3. Replace or remove the document through its menu. Sign in as the member to
   try the read-only experience and department directory.

For chat knowledge, follow the [Discord setup](docs/integrations.md#discord-curated-imports).
Preview a channel or public thread, select useful messages, and confirm
organization-wide sharing. Reviewing the selection updates the snapshot;
removing it from the brain never deletes the original messages.

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

[Contributing](CONTRIBUTING.md) · [Integrations](docs/integrations.md) ·
[Architecture decisions](docs/adr/README.md) · [Troubleshooting](docs/troubleshooting.md) ·
[Local API docs](http://localhost:3001/api/docs)

## Credits & license

Built on [digohq/app-starter](https://github.com/digohq/app-starter), which provides
the authentication and multi-tenant foundation. This is an independent community
project using Cognee as its knowledge layer, not an official Cognee product.

Available under the [MIT License](LICENSE).
