CREATE TYPE "SourceConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

CREATE TABLE "source_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "encrypted_credential" TEXT,
    "status" "SourceConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "last_verified_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "source_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "source_connections_credential_state_check" CHECK (
        ("status" = 'ACTIVE' AND "encrypted_credential" IS NOT NULL) OR
        ("status" = 'DISCONNECTED' AND "encrypted_credential" IS NULL)
    )
);

CREATE TABLE "source_locations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "locator" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "source_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "source_connections_id_organization_id_key" ON "source_connections"("id", "organization_id");
CREATE UNIQUE INDEX "source_connections_organization_id_connector_id_external_ac_key" ON "source_connections"("organization_id", "connector_id", "external_account_id");
CREATE INDEX "source_locations_organization_id_connection_id_archived_at_idx" ON "source_locations"("organization_id", "connection_id", "archived_at");
CREATE UNIQUE INDEX "source_locations_connection_id_external_id_key" ON "source_locations"("connection_id", "external_id");

ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_locations" ADD CONSTRAINT "source_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_locations" ADD CONSTRAINT "source_locations_connection_id_organization_id_fkey" FOREIGN KEY ("connection_id", "organization_id") REFERENCES "source_connections"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
