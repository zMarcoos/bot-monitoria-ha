import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import UserService from '../database/services/userService.js';
import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { getMember } from '../utils/userUtils.js';
import { createPaginationCollector } from '../utils/interactionHandlers.js';
import CustomError from '../exceptions/customError.js';

const userService = new UserService();
const USERS_PER_PAGE = 10;

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Exibe o ranking dos usuários com base no desempenho em atividades'),

  async execute(interaction) {
    try {
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

        if (b.xp !== a.xp) {
          return b.xp - a.xp;
        }

        return b.activityHistory.length - a.activityHistory.length;
      });

      const generateEmbed = async (page) => {
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

      const initialEmbed = await generateEmbed(0);

      await createPaginationCollector({
        interaction,
        initialEmbed,
        totalItems: rankedUsers.length,
        itemsPerPage: USERS_PER_PAGE,
        generateEmbed,
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [CustomError.getFormattedMessage(error)],
        ephemeral: true
      });
    }
  },
};
