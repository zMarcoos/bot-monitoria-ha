import { Collection, Events, PermissionsBitField } from 'discord.js';
import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';

export default {
  once: false,
  event: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.channel.id !== '1304910568188284979' && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: `Por favor, use os comandos no canal <#1304910568188284979>.`,
        ephemeral: true
      });
    }

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
          content: `Você está indo rápido demais, ${interaction.user}!`,
          embeds: [
            createEmbed({
              title: 'Cooldown',
              description: `Por favor, espere <t:${timeLeft}:R> antes de reutilizar o comando \`${command.data.name}\`.`,
              color: EMBED_COLORS.RED
            })
          ],
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

      const response = {
        content: `${interaction.user}`,
        embeds: [
          createEmbed({
            title: 'Erro',
            description: 'Ocorreu um erro ao executar este comando. Fale com um desenvolvedor.',
            color: EMBED_COLORS.RED
          })
        ],
        ephemeral: true
      }

      if (interaction.replied || interaction.deferred) {
			  await interaction.followUp(response);
		  } else {
			  await interaction.reply(response);
		  }
    }
  },
}