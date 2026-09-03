# 0010 — Keep the company brain independent of its knowledge engine

- **Status**: Accepted
- **Date**: 2026-09-03

## Context

The onboarding product needs to ingest documents and, later, conversations
from sources such as Discord and Slack. Cognee is the first knowledge engine,
but the deployment model is not settled: the project may embed the TypeScript
SDK, connect to a hosted service, or use different engines in different
environments.

Letting provider request and response types cross into controllers, persisted
models, or the web app would make that decision expensive to revisit. It would
also force every source connector to know how Cognee represents input.

## Decision

The company-brain domain depends on a small `KnowledgeEngine` port. It accepts
normalized text or binary content scoped to an `organizationId`, and returns a
normalized ingestion reference or an answer with evidence.

Cognee implements that port behind Nest's `KNOWLEDGE_ENGINE` injection token.
Dataset names, tenant options, native runtime lifecycle, and Cognee response
parsing stay inside the adapter.

PostgreSQL owns product metadata about knowledge sources and their processing
state. It does not store Cognee response bodies. API contracts shared with the
web app contain no provider-specific fields.

Questions are stateless in the first slice. A response explicitly distinguishes
`ANSWERED` from `NO_ANSWER`. Provider-generated text without supporting evidence
is treated as no answer, and unanswered questions are not silently inserted
into the graph. Persistence, confidence policy, expert routing, approval, and
learning from approved answers can therefore be designed as a separate
workflow.

## Consequences

Document uploads and future Discord or Slack connectors share one ingestion
path. Replacing the embedded SDK with a cloud adapter does not require changing
the product routes or UI.

Provider-specific features must either fit the port or be introduced through a
deliberate extension. That is intentional friction: capabilities should enter
the product because the product needs them, not because one SDK exposes them.

Document indexing is synchronous in this first vertical slice. The database
still records `PROCESSING`, `READY`, and `FAILED` states so the external call can
move behind a durable queue without changing the API response or UI model. Move
it before accepting large documents or production traffic.
