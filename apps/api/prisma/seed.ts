/**
 * Local demo: Northstar Studio, two accounts, and a department directory.
 * Creates missing records without resetting existing passwords or configuration.
 *
 *   pnpm --filter @app-starter/api prisma:seed
 */
import { PrismaClient, OrgRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Run directly via ts-node, so nothing else has loaded the env yet. Mirrors
// the order in prisma.config.ts: tests read .env.test, everything else .env.
const apiRoot = path.resolve(__dirname, '..');
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.join(apiRoot, '.env.test.local') });
  dotenv.config({ path: path.join(apiRoot, '.env.test') });
} else {
  dotenv.config({ path: path.join(apiRoot, '.env') });
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env first.');
}

// The demo owner is a global admin with a password published in this file and
// in the README. Creating it against a production database hands anyone who
// has read the repository full control of the app, so refuse by default.
// `SEED_ALLOW_PRODUCTION=true` is the deliberate opt-out.
if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
  throw new Error(
    'Refusing to seed with NODE_ENV=production: the demo accounts have a publicly known password ' +
      'and owner@example.com is a global admin. Set SEED_ALLOW_PRODUCTION=true if you really mean it.',
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = 'Password123!';

async function seedDemoOrganization() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      password: passwordHash,
      name: 'Maya Chen',
      username: 'maya',
      emailVerifiedAt: new Date(),
      isGlobalAdmin: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      email: 'member@example.com',
      password: passwordHash,
      name: 'Sam Rivera',
      username: 'sam',
      emailVerifiedAt: new Date(),
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'northstar-studio' },
    update: {},
    create: {
      name: 'Northstar Studio',
      slug: 'northstar-studio',
      description: 'A fictional design studio for exploring employee onboarding.',
      timezone: 'UTC',
    },
  });

  const memberships = new Map<string, string>();
  for (const [user, role] of [
    [owner, OrgRole.OWNER],
    [member, OrgRole.MEMBER],
  ] as const) {
    const membership = await prisma.organizationMember.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: {},
      create: { userId: user.id, organizationId: organization.id, role },
    });
    memberships.set(user.id, membership.id);
  }

  const departments = [
    {
      slug: 'people-operations',
      name: 'People Operations',
      description: 'Onboarding, benefits, time off, and workplace policies.',
      contactUserId: owner.id,
    },
    {
      slug: 'finance',
      name: 'Finance',
      description: 'Expenses, purchasing, reimbursements, and company cards.',
      contactUserId: member.id,
    },
  ];

  for (const departmentData of departments) {
    const department = await prisma.department.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: departmentData.slug,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        slug: departmentData.slug,
        name: departmentData.name,
        description: departmentData.description,
      },
    });
    const organizationMemberId = memberships.get(departmentData.contactUserId);
    if (!organizationMemberId) {
      throw new Error(`Missing membership for department contact ${departmentData.contactUserId}`);
    }

    await prisma.departmentContact.upsert({
      where: {
        departmentId_organizationMemberId: {
          departmentId: department.id,
          organizationMemberId,
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        departmentId: department.id,
        organizationMemberId,
      },
    });
  }

  console.log(`Demo ready: ${organization.name} · 2 accounts · 2 departments`);
  console.log(`  owner@example.com / ${DEMO_PASSWORD}  (global admin)`);
  console.log(`  member@example.com / ${DEMO_PASSWORD}`);
}

async function main() {
  await seedDemoOrganization();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
