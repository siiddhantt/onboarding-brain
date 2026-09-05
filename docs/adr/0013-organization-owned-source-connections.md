# 0013 — Organization-owned source connections

- **Status**: Accepted
- **Date**: 2026-09-05

## Decision

Separate three lifecycles:

- `SourceConnection`: an organization's provider account, normalized non-secret
  configuration, encrypted credential, status and revision.
- `SourceLocation`: a reusable, explicitly saved collection within that
  connection. A composite foreign key enforces organization ownership.
- `KnowledgeSource`: the approved snapshot and derived index. Its identity is
  still organization + connector + external collection, independent of credentials.

Owners/admins manage connections. Adapters receive request-scoped access, never
look up tenant credentials in the environment, and own provider validation,
location discovery/resolution, read permissions and search. Configuration is
immutable once connected; a different external account needs a new connection.
Replacing credentials verifies access before an optimistic-revision update.
Errors and public response projections never include credentials or ciphertext.

Previews use saved location IDs, not arbitrary client-supplied locators. They are
bound to user, organization, connection revision and location revision. These are
rechecked after provider reads and before accepting an import. Saving a location
serializes its database write with concurrent connection changes. Already
accepted synchronous indexing is not cancellable by disconnecting.

Disconnect erases credentials, not approved knowledge. Forgetting a location
soft-archives the shortcut and invalidates previews, not the source snapshot.
Reconnection and explicit re-saving retain identity. Upstream changes remain
reviewed, never automatically accepted or treated as deletion by absence.

## Scope

Discord uses one bot credential per organization/server connection. The UI can
discover readable text channels or save a public thread by link. Other adapters
can reuse connections, locations and curation; their authorization and OAuth
installation flows still need provider-specific work. No synthetic plugin system
or auto-sync policy is introduced.

`ConnectionCredentials` uses authenticated encryption with tenant/connection
associated data. Its master key is deployment infrastructure, kept separate from
the database. A managed secret store, versioned key rotation, credential-change
audit history and durable ingestion jobs remain production follow-ups. Cognee is
still an operator-managed knowledge engine with org-isolated datasets.

References: [Discord channel directory](https://docs.discord.com/developers/resources/guild#get-guild-channels),
[permission overwrites](https://docs.discord.com/developers/topics/permissions),
[OWASP cryptographic storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html).
