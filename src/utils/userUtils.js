import client from '../index.js';

export async function getMember(userId) {
  try {
    const guild = client.guilds.cache.first();
    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch(userId);
    }

    return member;
  } catch (error) {
    return null;
  }
}