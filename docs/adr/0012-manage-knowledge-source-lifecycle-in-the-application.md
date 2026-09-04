# 0012 — Manage knowledge source lifecycle in the application

- **Status**: Accepted
- **Date**: 2026-09-04

## Context

Knowledge will arrive from documents first and later from curated Discord,
Slack, and other sources. An administrator must be able to correct or remove a
source without leaving stale derived knowledge behind. Provider item and
dataset identifiers are implementation details, while citations and product
workflows need a stable application identity.

Cognee exposes item-level update and deletion. Updating replaces an item and
reprocesses its derived knowledge; deleting a dataset item removes its graph and
vector metadata. These operations are the narrowest provider calls that satisfy
the product lifecycle.

## Decision

PostgreSQL owns a stable `KnowledgeSource` identity. It records an opaque
provider item reference, an optional opaque container reference, a version, and
the last successful indexing time. None of those provider references cross the
public API boundary.

The `KnowledgeEngine` port exposes normalized `replace` and `remove` operations
in addition to ingestion and search. Cognee adapters translate those operations
to native item update and deletion. Legacy records without a stored container
reference are resolved by their organization-derived dataset.

Only organization owners and admins may replace or remove a source. A source is
claimed with an atomic status transition before the provider call, preventing
concurrent mutations. Replacement keeps the application source id and advances
its version only after successful indexing. Removal deletes provider knowledge
before soft-archiving the local record, so an archived source does not knowingly
remain retrievable.

A provider deletion failure returns the source to its prior state because the
provider did not confirm deletion. Once deletion is confirmed, local archival
failure leaves the source in `REMOVING` for reconciliation rather than falsely
marking it ready. A failed replacement is marked `FAILED`: provider update is
not transactional with PostgreSQL, so the application must not claim the index
is healthy after an uncertain outcome.

## Consequences

Document uploads and future connectors can share the same lifecycle contract.
Discord-specific concepts such as channel, thread, and message selection remain
connector metadata rather than becoming knowledge-engine concerns.

Operations are synchronous in this slice. The explicit `UPDATING`, `REMOVING`,
and `FAILED` states provide a safe seam for a durable queue, retries, and
reconciliation before production-scale ingestion.

References: [Cognee update](https://docs.cognee.ai/api-reference/update/update),
[Cognee item deletion](https://docs.cognee.ai/api-reference/datasets/delete-data).
