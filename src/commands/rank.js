import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import UserService from '../database/services/userService.js';
import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { getMember } from '../utils/userUtils.js';

const userService = new UserService();
const USERS_PER_PAGE = 10;

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Exibe o ranking dos usuários com base no desempenho em atividades'),

  async execute(interaction) {
    try {
      // Garante que o Discord não expire a interação enquanto processa
      await interaction.deferReply({ ephemeral: true });

      const users = await userService.listUsers();

      if (!users || users.length === 0) {
        await interaction.editReply({
          embeds: [
            createEmbed({
              title: 'Ranking',
              description: 'Nenhum dado de usuário encontrado.',
              color: EMBED_COLORS.RED,
            }),
          ],
        });
        return;
      }

      const rankedUsers = users.sort((a, b) => {
        if (b.level !== a.level) {
          return b.level - a.level;
        }
        return b.xp - a.xp;
      });

      let currentPage = 0;

      const createPageEmbed = async (page) => {
        const start = page * USERS_PER_PAGE;
        const end = start + USERS_PER_PAGE;
        const pageUsers = rankedUsers.slice(start, end);

        const description = await Promise.all(
          pageUsers.map(async (user, index) => {
            const rank = start + index + 1;
            let memberName;

            try {
              const member = await getMember(user.id);
              memberName = member?.nickname || member?.user?.globalName || 'Usuário Anônimo';
            } catch {
              memberName = 'Usuário Anônimo';
            }

            return `#${rank} **${memberName}**\n`
              + `🎯 **Nível:** ${user.level}\n`
              + `✨ **XP:** ${user.xp}\n`
              + `📘 **Questões Resolvidas:** ${user.activityHistory.length}`;
          })
        ).then(lines => lines.join('\n\n'));

        return new EmbedBuilder()
          .setTitle('🏆 Ranking dos Melhores Alunos')
          .setDescription(description || 'Nenhum usuário encontrado nesta página.')
          .setFooter({ text: `Página ${page + 1} de ${Math.ceil(users.length / USERS_PER_PAGE)}` })
          .setColor(EMBED_COLORS.BLUE);
      };

      const createButtons = (page) => {
        return new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('⬅️ Anterior')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('➡️ Próximo')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === Math.ceil(users.length / USERS_PER_PAGE) - 1),
          );
      };

      const initialEmbed = await createPageEmbed(currentPage);
      const buttons = createButtons(currentPage);

      const message = await interaction.editReply({
        embeds: [initialEmbed],
        components: [buttons],
      });

      const collector = message.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async (btnInteraction) => {
        if (btnInteraction.user.id !== interaction.user.id) {
          await btnInteraction.reply({
            content: 'Apenas o usuário que usou o comando pode interagir.',
            ephemeral: true,
          });
          return;
        }

        try {
          if (btnInteraction.customId === 'prev') {
            currentPage -= 1;
          } else if (btnInteraction.customId === 'next') {
            currentPage += 1;
          }

          const updatedEmbed = await createPageEmbed(currentPage);
          const updatedButtons = createButtons(currentPage);

          await btnInteraction.update({
            embeds: [updatedEmbed],
            components: [updatedButtons],
          });
        } catch (error) {
          console.error('Erro ao processar interação:', error);
          if (error.code === 10008) {
            await btnInteraction.reply({
              content: 'A mensagem original foi deletada e a interação foi encerrada.',
              ephemeral: true,
            });
          }
        }
      });

      collector.on('end', async () => {
        try {
          const disabledButtons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅️ Anterior')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('next')
                .setLabel('➡️ Próximo')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            );

          await message.edit({
            components: [disabledButtons],
          });
        } catch (error) {
          console.error('Erro ao desativar botões:', error);
          if (error.code === 10008) {
            console.log('Mensagem já foi deletada. Nenhuma ação necessária.');
          }
        }
      });
    } catch (error) {
      console.error('Erro ao gerar ranking:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [
            createEmbed({
              title: 'Erro',
              description: 'Não foi possível gerar o ranking. Tente novamente mais tarde.',
              color: EMBED_COLORS.RED,
            }),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
