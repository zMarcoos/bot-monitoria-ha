import { Event } from "#base";
import { createEmbed } from "@magicyan/discord";
import { getActivityById } from "#database/repositories/activityRepository.js";
import { activitiesService } from "#database/services/activitiesService.js";
import { getUserById } from "#database/repositories/userRepository.js";
import { runQuestionnaire, Answer } from "#functions/quiz.js";
import { ChannelType, Message } from "discord.js";
import { ROLES } from "#functions/level.js";
import { getRandomAdventureTimePhoto } from "#functions/images.js";
import { log } from "#settings";

const SUBMISSION_CHANNEL_ID: string = "1309657893460512902";
const WELCOME_CHANNEL_ID: string = "1298472452955045929";

new Event({
    name: "Message Reaction Add",
    event: "messageReactionAdd",
    async run(reaction, user) {
      if (user.bot) return;
      if (reaction.message.channel.id !== SUBMISSION_CHANNEL_ID) return;

      let { message, emoji } = reaction;
      if (message.content === null) {
        message = await message.fetch();
      }

      const activityId = Number(message.embeds[0]?.fields?.find(field => field.name === "ID da atividade:")?.value);
      const userId = message.embeds[0]?.footer?.text;

      if (!activityId || !userId) {
        await message.reply({
          content: "Não foi possível identificar a atividade ou o usuário.",
          options: { ephemeral: true }
        });

        return;
      }

      const activity = await getActivityById(activityId);
      if (!activity) {
        await message.reply({
          content: "Atividade não encontrada.",
          options: { ephemeral: true }
        });
        return;
      }

      const welcomeChannel = message.guild?.channels.cache.get(WELCOME_CHANNEL_ID);
      if (!welcomeChannel || !welcomeChannel.isTextBased()) {
        await message.reply({
          content: "Canal de boas-vindas não encontrado.",
          options: { ephemeral: true }
        });
        return;
      }

      const userData = await getUserById(userId);
      if (!userData) {
        await message.reply({
          content: "Usuário não encontrado.",
          options: { ephemeral: true }
        });
        return;
      }

      switch (emoji.name) {
        case "✅":
          await reaction.message.delete();
          
          const previousLevel = userData.level;
          const updatedUser = await activitiesService.complete(activityId, userId);

          await welcomeChannel.send({
            content: `<@${userId}>`,
            embeds: [
              createEmbed({
                title: "✅ Atividade completada",
                description: `🎉 A submissão de <@${userId}> (${userData.enrollment}) para a atividade "${activity.title}" foi **aprovada**! 🎉`,
                fields: [
                  { name: "ID da atividade:", value: activityId.toString() },
                  { name: "Responsável:", value: `<@${userId}>` }
                ],
                color: "Green",
                image: { url: getRandomAdventureTimePhoto().url }
              })
            ],
          });

          if (!updatedUser || updatedUser?.level <= previousLevel) return;

          const role = message.guild?.roles.cache.get(ROLES[updatedUser.level]?.id);
          if (!role) return;

          await message.guild?.members.cache.get(userId)?.roles.add(role);
          await welcomeChannel.send({
            content: `<@${userId}>`,
            embeds: [
              createEmbed({
                title: "🎉 Parabéns! Você subiu de nível!",
                description: `🚀 Você agora é um ${updatedUser.role}! 🚀`,
                fields: [
                  { name: "Nível anterior:", value: previousLevel.toString() },
                  { name: "Novo nível:", value: updatedUser.level.toString() }
                ],
                color: "Green",
                image: { url: getRandomAdventureTimePhoto().url }
              })
            ],
          });
          break;
          case "❌":
            await reaction.message.delete();

            let questionnaireResult: { answers: Answer[]; botMessages: Message[] } | null = null;

            if (reaction.message.channel.type === ChannelType.GuildText) {
              questionnaireResult = await runQuestionnaire({
                channel: reaction.message.channel,
                memberId: user.id,
                questions: ["Qual foi o motivo da reprovação?"],
              });
            }

            if (!questionnaireResult) return;

            const { answers, botMessages } = questionnaireResult;

            await activitiesService.fail(activityId, userId);
            await welcomeChannel.send({
              content: `<@${userId}>`,
              embeds: [
                createEmbed({
                  title: "❌ Atividade reprovada",
                  description: `A submissão de <@${userId}> ${userData.enrollment} para a atividade "${activity.title}" foi **reprovada**.`,
                  fields: [
                    { name: "ID da atividade:", value: activityId.toString() },
                    { name: "Responsável:", value: `<@${userId}>` },
                    { name: "Motivo:", value: answers[0]?.response || "Sem motivo" },
                  ],
                }),
              ],
            });

            const messagesToDelete = [
              ...botMessages.filter((message) => message != null),
              ...answers.map((answer) => answer.message).filter((message) => message != null),
            ];

            try {
              await Promise.all(messagesToDelete.map((message) => message.delete()));
            } catch (error) {
              log.error("Erro ao deletar mensagens:", error);
            }
            break;
        default:
          return;
      }
    },
});