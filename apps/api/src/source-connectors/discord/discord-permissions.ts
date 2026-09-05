import { discordObject } from './discord.client';

const VIEW_AND_HISTORY = (1n << 10n) | (1n << 16n);

/** Discord's everyone → combined roles → member overwrite order. Fail closed. */
export const canReadDiscordChannel = (
  guild: Record<string, unknown>,
  member: Record<string, unknown>,
  userId: string,
  channel: Record<string, unknown>,
): boolean => {
  try {
    if (guild.owner_id === userId) return true;
    if (
      !Array.isArray(guild.roles) ||
      !Array.isArray(member.roles) ||
      !Array.isArray(channel.permission_overwrites)
    )
      return false;
    const roleIds = new Set([guild.id, ...member.roles]);
    let permissions = guild.roles
      .map(discordObject)
      .filter((role) => roleIds.has(role.id))
      .reduce((bits, role) => bits | BigInt(String(role.permissions)), 0n);
    if (permissions & 8n) return true;
    const overwrites = channel.permission_overwrites.map(discordObject);
    const apply = (entries: Record<string, unknown>[]) => {
      const deny = entries.reduce((bits, entry) => bits | BigInt(String(entry.deny)), 0n);
      const allow = entries.reduce((bits, entry) => bits | BigInt(String(entry.allow)), 0n);
      permissions = (permissions & ~deny) | allow;
    };
    apply(overwrites.filter((entry) => entry.id === guild.id && entry.type === 0));
    apply(
      overwrites.filter(
        (entry) => entry.id !== guild.id && roleIds.has(entry.id) && entry.type === 0,
      ),
    );
    apply(overwrites.filter((entry) => entry.id === userId && entry.type === 1));
    return (permissions & VIEW_AND_HISTORY) === VIEW_AND_HISTORY;
  } catch {
    return false;
  }
};
