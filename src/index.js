import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { loadCommands, loadListeners, loadSlashCommands } from './handler.js';
import { calculateLevelXPDistribution } from './levelling/level.js';
import { initScheduler } from './scheduler/scheduler.js';
import { config } from 'dotenv';
import CustomError from './exceptions/customError.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
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

    await client.login(process.env.DISCORD_TOKEN);
    console.log("Bot logado com sucesso!");
  } catch (error) {
    CustomError.logger(error, 'initializeBot');
    process.exit(1);
  }
}

initializeBot();
initScheduler();

export default client;
