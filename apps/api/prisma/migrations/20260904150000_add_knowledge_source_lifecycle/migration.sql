-- AlterEnum
ALTER TYPE "KnowledgeSourceStatus" ADD VALUE 'UPDATING';
ALTER TYPE "KnowledgeSourceStatus" ADD VALUE 'REMOVING';

-- AlterTable
ALTER TABLE "knowledge_sources"
ADD COLUMN "provider_container_reference" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "last_indexed_at" TIMESTAMPTZ(6);

-- Existing ready sources were indexed when their source records were created.
UPDATE "knowledge_sources"
SET "last_indexed_at" = "createdAt"
WHERE "status" = 'READY';
