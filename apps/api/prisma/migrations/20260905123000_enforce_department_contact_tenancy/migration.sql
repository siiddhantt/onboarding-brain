BEGIN;

CREATE UNIQUE INDEX "departments_id_organization_id_key" ON "departments"("id", "organization_id");
CREATE UNIQUE INDEX "organization_members_id_organization_id_key" ON "organization_members"("id", "organization_id");

-- Both relations must belong to the contact's tenant, including writes outside the API.
ALTER TABLE "department_contacts"
    DROP CONSTRAINT "department_contacts_department_id_fkey",
    DROP CONSTRAINT "department_contacts_organization_member_id_fkey",
    ADD CONSTRAINT "department_contacts_department_id_organization_id_fkey"
        FOREIGN KEY ("department_id", "organization_id") REFERENCES "departments"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "department_contacts_organization_member_id_organization_id_fkey"
        FOREIGN KEY ("organization_member_id", "organization_id") REFERENCES "organization_members"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
