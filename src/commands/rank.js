import { SlashCommandBuilder } from 'discord.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { getMember } from '../utils/userUtils.js';
import { createPaginationCollector } from '../utils/interactionHandlers.js';
import { createEmbed } from '../utils/messageUtils.js';
import Command from './interface/command.js';
import UserService from '../database/services/userService.js';
import CustomError from '../exceptions/customError.js';

const userService = new UserService();
const USERS_PER_PAGE = 10;

export default new Command({
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Exibe o ranking dos usuários com base no desempenho em atividades'),
  cooldown: 5,
  execute: async (interaction) => {
    const users = await userService.listUsers();

    if (!users || users.length === 0) {
      await interaction.editReply({
        embeds: [
          createEmbed({
            title: '🏆 Ranking dos Melhores Alunos',
            description: 'Nenhum usuário encontrado.',
            color: EMBED_COLORS.BLUE,
          }),
        ],
      });
      return;
    }

    const calculateAverageSubmissionTime = (activities) => {
      if (!activities || activities.length === 0) return Infinity;
      const totalTime = activities.reduce((sum, activity) => sum + new Date(activity.submissionDate).getTime(), 0);
      return totalTime / activities.length;
    };


    const rankedUsers = users.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.activityHistory.length !== a.activityHistory.length) {
        return b.activityHistory.length - a.activityHistory.length;
      }

      return calculateAverageSubmissionTime(b.activityHistory) - calculateAverageSubmissionTime(a.activityHistory);
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
      ).then((lines) => lines.join('\n\n'));

      return createEmbed({
        title: '🏆 Ranking dos Melhores Alunos',
        description: description || 'Nenhum usuário encontrado nesta página.',
        footer: `Página ${page + 1} de ${Math.ceil(users.length / USERS_PER_PAGE)}`,
        color: EMBED_COLORS.BLUE,
      });
    };

    const initialEmbed = await generateEmbed(0);

    await createPaginationCollector({
      interaction,
      initialEmbed,
      totalItems: rankedUsers.length,
      itemsPerPage: USERS_PER_PAGE,
      generateEmbed,
    });
  },
});
