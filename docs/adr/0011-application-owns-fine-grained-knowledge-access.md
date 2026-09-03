# 0011 — Keep fine-grained knowledge access in the application layer

- **Status**: Accepted
- **Date**: 2026-09-03

## Context

Cognee isolates storage and permissions at the dataset boundary. A principal may
receive read, write, delete, or share permission for a dataset, but Cognee does
not provide document-level permissions inside one dataset.

The onboarding product requires rules that may eventually vary by department,
team, employment type, source classification, or individual user. It also uses
a server-side Cognee credential rather than exposing Cognee identities or API
keys to browser clients.

## Decision

The application backend is the authority for product access. It verifies the
authenticated user, organization membership, and product role before calling
the knowledge engine. Browser clients cannot provide a raw Cognee dataset name
or choose a dataset directly.

The first implementation uses one derived dataset name per organization. The
application stores departments, contacts, workflow state, and future access
rules in PostgreSQL. NodeSets or other semantic labels may organize knowledge,
but they are not treated as security boundaries.

If a later requirement needs hard isolation within an organization, it must use
separate datasets selected by the backend after authorization, or another
storage boundary with equivalent enforcement. That change must include tests
showing that restricted content cannot be retrieved or cited by an unauthorized
user.

## Consequences

Cognee provides a strong organization-level retrieval boundary while the
application can evolve its roles and workflow without coupling them to provider
DTOs.

Every ingestion and search path must continue to derive its organization scope
on the server. Fine-grained permissions cannot be added as UI-only filtering;
they require backend policy and isolation tests.

Reference: [Cognee datasets and permissions](https://docs.cognee.ai/core-concepts/multi-user-mode/permissions-system/datasets).
