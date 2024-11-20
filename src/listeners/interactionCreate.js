import { Collection, Events } from 'discord.js';

export default {
  once: false,
  event: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { commands, cooldowns } = interaction.client;

    const command = commands.get(interaction.commandName);
    if (!command) return;

    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown ?? 0) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = Math.round(expirationTime / 1000);
        return interaction.reply({
          content: `Por favor, espere <t:${timeLeft}:R> segundo(s) antes de reutilizar o comando \`${command.data.name}\`.`,
          ephemeral: true
        });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);

      if (interaction.replied || interaction.deferred) {
			  await interaction.followUp({ content: 'Ocorreu um erro ao executar este comando. Fale com um desenvolvedor.', ephemeral: true });
		  } else {
			  await interaction.reply({ content: 'Ocorreu um erro ao executar este comando. Fale com um desenvolvedor.', ephemeral: true });
		  }
    }
  },
}