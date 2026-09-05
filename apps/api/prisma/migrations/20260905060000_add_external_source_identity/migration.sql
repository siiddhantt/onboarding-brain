ALTER TABLE "knowledge_sources"
ADD COLUMN "connector_id" TEXT,
ADD COLUMN "external_id" TEXT,
ADD COLUMN "source_url" TEXT,
ADD COLUMN "content_hash" TEXT,
ADD COLUMN "selection" JSONB;

CREATE UNIQUE INDEX "knowledge_sources_organization_id_connector_id_external_id_key"
ON "knowledge_sources"("organization_id", "connector_id", "external_id");
