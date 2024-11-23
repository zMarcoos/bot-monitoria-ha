import { Events } from 'discord.js';
import { loadMessages } from '../utils/messageUtils.js';

export default {
  once: true,
  event: Events.ClientReady,
  async execute(client) {
    console.log(`Estou pronto como ${client.user.tag}!`);

    const activityChannel = client.channels.cache.get('1309657893460512902');
    if (!activityChannel) return;

    loadMessages(activityChannel);
  },
}