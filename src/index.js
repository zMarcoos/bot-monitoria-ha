import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { loadCommands, loadListeners, loadSlashCommands } from './handler.js';
import { calculateLevelXPDistribution } from './levelling/level.js';
import { initScheduler } from './scheduler/scheduler.js';
import { config } from 'dotenv';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
client.cooldowns = new Collection();

async function initializeBot() {
  try {
    await loadCommands(client);
    await loadListeners(client);
    await loadSlashCommands(client);
    await calculateLevelXPDistribution();

    console.log("Bot inicializado com sucesso!");
  } catch (error) {
    console.error("Erro durante a inicialização do bot:", error);
    process.exit(1);
  }

  client.login(process.env.DISCORD_TOKEN);
}

initializeBot();
initScheduler();

export default client;