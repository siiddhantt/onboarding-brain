import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SourceConnectionsService } from '../src/source-connectors/connections/source-connections.service';

/** Explicit, idempotent upgrade for the former single-organization env configuration. */
const migrate = async () => {
  const {
    DISCORD_BOT_TOKEN: credential,
    DISCORD_GUILD_ID: guildId,
    DISCORD_ORGANIZATION_ID: organizationId,
    DISCORD_CHANNEL_IDS: channels,
  } = process.env;
  if (!credential || !guildId || !organizationId || !channels)
    throw new Error('The four legacy DISCORD_* fields are required for this one-time migration.');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const prisma = app.get(PrismaService);
    const connections = app.get(SourceConnectionsService);
    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId, role: OrgRole.OWNER },
    });
    if (!owner) throw new Error('The configured organization has no owner; nothing was migrated.');
    const existing = (await connections.list(owner.userId, organizationId)).find(
      (item) => item.connectorId === 'discord' && item.config.guildId === guildId,
    );
    const connection =
      existing ??
      (await connections.create(owner.userId, organizationId, {
        connectorId: 'discord',
        name: 'Team Discord',
        config: { guildId },
        credential,
      }));
    for (const locator of [
      ...new Set(
        channels
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ]) {
      if (!connection.locations.some((location) => location.locator === locator))
        await connections.saveLocation(owner.userId, organizationId, connection.id, {
          locator,
          expectedRevision: connection.revision,
        });
    }
    console.log(
      'Discord connection and saved locations are ready. Published knowledge was not modified. Remove the four legacy DISCORD_* fields from .env after checking the UI.',
    );
  } finally {
    await app.close();
  }
};

migrate().catch(() => {
  // Provider/DB failures must never print token-bearing arguments from this operator script.
  console.error(
    'Migration did not complete. Check the encryption key, legacy fields, organization and bot access; it is safe to retry.',
  );
  process.exitCode = 1;
});
