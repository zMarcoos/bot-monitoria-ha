import { Command } from "#base";
import {
  createActivity,
  getActivityById,
} from "#database/repositories/activityRepository.js";
import { getUserById } from "#database/repositories/userRepository.js";
import { userActivityRepository } from "#database/repositories/userActivityRepository.js";
import { ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonStyle } from "discord.js";
import { parse } from "date-fns";
import { createEmbed, createRow } from "@magicyan/discord";

const ACTIVITY_CHANNEL_ID = "1309657893460512902";

new Command({
  name: "atividade",
  description: "Comando de atividade",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "adicionar",
      description: "Adiciona uma atividade",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "titulo",
          description: "Titulo da atividade",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "tipo",
          description: "Tipo da atividade",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            {
              name: "Prático",
              value: "pratico",
            },
            {
              name: "Desafio",
              value: "desafio",
            },
            {
              name: "Trabalho",
              value: "trabalho",
            },
          ],
        },
        {
          name: "data",
          description: "Data de entrega da atividade (padrão dia/mês/ano hora:minuto)",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "descricao",
          description: "Descrição da atividade",
          type: ApplicationCommandOptionType.String,
          required: true,
        }
      ]
    },
    {
      name: "submeter",
      description: "Submeter a atividade do estudante",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "id_atividade",
          description: "ID da atividade",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "resposta",
          description: "Resposta da atividade",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ]
    },
    {
      name: "listar",
      description: "Listar todas as atividades e os usuários que as completaram",
      type: ApplicationCommandOptionType.Subcommand,
    }
  ],
  async run(interaction) {
    await interaction.deferReply({ ephemeral });

    const { options, member } = interaction;

    const subcommand = options.getSubcommand(true);

    switch (subcommand) {
      case "adicionar": {
        if (!member.permissions.has("ManageMessages")) {
          await interaction.editReply({
            content: "Você não tem permissão para adicionar atividades.",
            options: { ephemeral: true },
          });
          return;
        }

        const title = options.getString("titulo", true);
        const type = options.getString("tipo", true);
        const date = options.getString("data", true);
        const description = options.getString("descricao", true);

        const dateRegex = /^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4} ([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!dateRegex.test(date)) {
          await interaction.editReply({
            content: "A data deve estar no formato dia/mês/ano hora:minuto.",
            options: { ephemeral: true },
          });
          return;
        }

        const expiresAt = parse(date, "dd/MM/yyyy HH:mm", new Date());
        if (isNaN(expiresAt.getTime())) {
          await interaction.editReply({
            content: "Data inválida.",
            options: { ephemeral: true },
          });
          return;
        }

        if (expiresAt < new Date()) {
          await interaction.editReply({
            content: "A data de entrega deve ser no futuro.",
            options: { ephemeral: true },
          });
          return;
        }

        await createActivity({
          title,
          type,
          createdAt: new Date(),
          description,
          expiresAt
        });

        await interaction.editReply({
          content: `Atividade adicionada com sucesso!`,
          options: { ephemeral: true },
        });
        break;
      }

      case "submeter": {
        const user = await getUserById(member.id);
        if (!user) {
          await interaction.editReply({
            content: "Usuário não encontrado.",
          });
          return;
        }

        const activityId = Number(options.getString("id_atividade", true));
        if (isNaN(activityId)) {
          await interaction.editReply({
            content: "ID da atividade inválido.",
          });
          return;
        }

        const response = options.getString("resposta", true).trim();

        const activity = await getActivityById(activityId);
        if (!activity) {
          await interaction.editReply({
            content: "Atividade não encontrada.",
          });
          return;
        }

        if (activity.expiresAt < new Date()) {
          await interaction.editReply({
            content: "Esta atividade expirou.",
          });
          return;
        }

        const userActivity = await userActivityRepository.getActivityById(activityId, member.id);
        if (userActivity) {
          await interaction.editReply({
            content: "Você já submeteu essa atividade.",
          });
          return;
        }

        await userActivityRepository.createActivity({
          activityId,
          userId: member.id,
          content: response
        });

        const submissionChannel = interaction.guild.channels.cache.get(ACTIVITY_CHANNEL_ID);
        if (!submissionChannel || !submissionChannel.isTextBased()) return;
        const submissionMessage = await submissionChannel.send({
          embeds: [
            createEmbed({
              title: "Nova submissão",
              description: `Atividade: ${activity.title} de ${member.user.tag} (${user.enrollment})`,
              color: "Blue",
              fields: [
                { name: "ID da atividade:", value: activityId.toString() },
                { name: "Resposta: ", value: response },
                { name: "Data de entrega", value: new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }) },
              ],
              footer: { text: member.id, iconURL: member.user.displayAvatarURL({ forceStatic: false }) },
            }),
          ],
        });

        await submissionMessage.react("✅");
        await submissionMessage.react("❌");

        await interaction.editReply({
          embeds: [
            createEmbed({
              title: "Submissão realizada",
              description: "Atividade submetida com sucesso e está pendente para aprovação!",
              color: "Green",
              author: { name: member.displayName, iconURL: member.user.displayAvatarURL() },
            }),
          ],
          options: { ephemeral: true },
        });

        break;
      }

      case "listar": {
        const initialPage = 0;

        const row = createRow(
          new ButtonBuilder()
            .setCustomId(`list_activities/${initialPage}`)
            .setLabel("Clique para listar atividades")
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.editReply({ components: [row] });
        break;
      }
    }
  },
});