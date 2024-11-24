import { Collection, Events, PermissionsBitField } from 'discord.js';
import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import CustomError from '../exceptions/customError.js';

const COMMAND_CHANNEL_ID = '1304910568188284979';

export default {
  once: false,
  event: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (
      interaction.channel.id !== COMMAND_CHANNEL_ID &&
      !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return interaction.reply({
        content: `Por favor, use os comandos no canal <#${COMMAND_CHANNEL_ID}>.`,
        ephemeral: true,
      });
    }

    const { commands, cooldowns } = interaction.client;

    const command = commands.get(interaction.commandName);
    if (!command) {
      return interaction.reply({
        embeds: [
          createEmbed({
            title: 'Erro',
            description: 'Comando não encontrado. Certifique-se de usar um comando válido.',
            color: EMBED_COLORS.RED,
          }),
        ],
        ephemeral: true,
      });
    }

    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown ?? 0) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = Math.floor(expirationTime / 1000);
        return interaction.reply({
          embeds: [
            createEmbed({
              title: 'Cooldown',
              description: `Aguarde mais <t:${timeLeft}:R> antes de reutilizar o comando \`${command.data.name}\`.`,
              color: EMBED_COLORS.YELLOW,
            }),
          ],
          ephemeral: true,
        });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await interaction.deferReply({ ephemeral: true });
      await command.execute(interaction);
    } catch (error) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [CustomError.getFormattedMessage(error)],
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          embeds: [CustomError.getFormattedMessage(error)],
          ephemeral: true,
        });
      }
    }
  },
};
