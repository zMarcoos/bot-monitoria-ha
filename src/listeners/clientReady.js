import { Events } from 'discord.js';

export default {
  once: true,
  event: Events.ClientReady,
  async execute(client) {
    console.log(`Estou pronto como ${client.user.tag}!`);
  },
}