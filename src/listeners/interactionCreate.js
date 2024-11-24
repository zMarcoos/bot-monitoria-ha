import { Collection, Events, PermissionsBitField } from 'discord.js';
import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import CustomError from '../exceptions/customError.js';

export default {
  once: false,
  event: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const commandChannelId = '1304910568188284979';

    if (
      interaction.channel.id !== commandChannelId &&
      !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return interaction.reply({
        content: `Por favor, use os comandos no canal <#${commandChannelId}>.`,
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
        const timeLeft = Math.round((expirationTime - now) / 1000);
        return interaction.reply({
          embeds: [
            createEmbed({
              title: 'Cooldown',
              description: `Aguarde mais **${timeLeft} segundos** antes de reutilizar o comando \`${command.data.name}\`.`,
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
      CustomError.logger(error);

      const response = createEmbed({
        title: 'Erro',
        description: `Ocorreu um erro ao executar o comando: ${error.message}`,
        color: EMBED_COLORS.RED,
      });

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    }
  },
};
