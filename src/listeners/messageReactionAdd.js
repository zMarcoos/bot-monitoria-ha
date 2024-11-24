import { Events } from 'discord.js';
import ActivityService from '../database/services/activityService.js';
import UserService from '../database/services/userService.js';
import { createEmbed, getRandomAdventureImage } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { collectSequentialResponses } from '../utils/interactionHandlers.js';
import CustomError from '../exceptions/customError.js';
import { getMember } from '../utils/userUtils.js';
import { ROLES } from '../levelling/level.js';

const SUBMISSION_CHANNEL_ID = '1309657893460512902';

export default {
  once: false,
  event: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.message.channel.id !== SUBMISSION_CHANNEL_ID) return;

    const { message, emoji } = reaction;

    const activityId = message.embeds[0]?.fields?.find((field) => field.name === 'ID da atividade:')?.value;
    const userId = message.embeds[0]?.footer?.text;

    if (!activityId || !userId) {
      await message.reply({
        content: 'Erro ao recuperar informações da atividade ou do usuário.',
        ephemeral: true,
      });
      return;
    }

    const activityService = new ActivityService();
    const userService = new UserService();
    const activity = await activityService.getActivity(activityId);

    if (!activity) {
      await message.reply({
        content: 'Atividade não encontrada.',
        ephemeral: true,
      });
      return;
    }

    const completedChannel = reaction.message.guild.channels.cache.get('1298472452955045929');
    if (!completedChannel) {
      await message.reply({
        content: 'Canal de atividades completadas não encontrado.',
        ephemeral: true,
      });
      return;
    }

    try {
      switch (emoji.name) {
        case '✅': {
          await activityService.approveSubmission(activityId, userId);

          const userData = await userService.getUser(userId);
          if (!userData) {
            await message.reply({
              content: 'Usuário não encontrado.',
              ephemeral: true,
            });
            return;
          }

          const member = await getMember(userId);
          if (!member) {
            await message.reply({
              content: 'Usuário não encontrado no servidor.',
              ephemeral: true,
            });
            return;
          }

          const previousLevel = userData.level;
          const updatedData = await userService.addActivityToUser(userId, activity);

          await completedChannel.send({
            embeds: [
              createEmbed({
                title: '✅ Atividade completada',
                description: `🎉 A submissão de ${member} ${userData.enrollment} para a atividade "${activity.title}" foi **aprovada**! 🎉`,
                color: EMBED_COLORS.GREEN,
                image: getRandomAdventureImage().url,
              }),
            ],
          });

          if (previousLevel < updatedData.level) {
            const role = reaction.message.guild.roles.cache.get(ROLES[updatedData.level]?.id);

            if (role) {
              await member.roles.add(role);
              await completedChannel.send({
                embeds: [
                  createEmbed({
                    title: '🎉 Level up! 🎉',
                    description: `🎉 ${member} ${userData?.enrollment || ''} subiu para o nível ${updatedData.level} e foi promovido para **${ROLES[updatedData.level]?.name}**! 🎉`,
                    color: EMBED_COLORS.GREEN,
                    image: getRandomAdventureImage().url,
                  }),
                ],
              });
            }
          }

          break;
        }

        case '❌': {
          const data = await collectSequentialResponses(user, reaction.message.channel, [
            {
              key: 'reason',
              question: 'Qual o motivo da rejeição?',
              deletable: true,
            },
          ]);

          if (!data) {
            await message.reply({
              content: 'Motivo de rejeição não fornecido.',
              ephemeral: true,
            });
            return;
          }

          await activityService.rejectSubmission(activityId, userId);
          await completedChannel.send({
            content: `<@${userId}>`,
            embeds: [
              createEmbed({
                title: 'Atividade rejeitada',
                description: `A submissão de ${user.tag} para a atividade "${activity.title}" foi **rejeitada**.\n\n**Motivo:** ${data.reason}`,
                color: EMBED_COLORS.RED,
              }),
            ],
          });
          break;
        }
      }

      await reaction.users.remove(user.id);
    } catch (error) {
      console.error('Erro em MessageReactionAdd:', error);
      CustomError.logToChannel(error, reaction.message.channel);
    } finally {
      await message.delete();
    }
  },
};
