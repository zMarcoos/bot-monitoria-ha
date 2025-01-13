import { bootstrapApp } from "#base";

await bootstrapApp({
  workdir: import.meta.dirname,
  intents: ["Guilds", "GuildMembers", "GuildMessages", "GuildMessageReactions", "MessageContent"],
});