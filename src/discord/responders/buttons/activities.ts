import { Responder, ResponderType } from "#base";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { z } from "zod";
import { query } from "#database";
import { createEmbed, createRow } from "@magicyan/discord";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const schema = z.object({
  page: z.coerce.number().int().default(0),
});

export default new Responder({
  customId: "list_activities/:page",
  type: ResponderType.Button,
  parse: (params) => schema.parse(params),
  async run(interaction, { page }) {
    const ACTIVITIES_PER_PAGE = 1;
    const MAX_USERS_DISPLAY = 25;

    const activities = await query(
      `
      SELECT
        a.id AS activity_id,
        a.title,
        a.type,
        a.description,
        a.expires_at,
        ua.user_id,
        u.enrollment,
        u.course,
        u.role,
        ua.date_completed
      FROM activities a
      LEFT JOIN user_activities ua ON a.id = ua.activity_id
      LEFT JOIN users u ON ua.user_id = u.id
      ORDER BY a.id ASC
      `
    );

    if (!activities.length) {
      await interaction.reply({
        content: "Nenhuma atividade encontrada.",
        ephemeral: true,
      });
      return;
    }

    const formatExpiresAt = (expiresAt: Date | null) => {
      if (!expiresAt) return "Sem prazo";
      const zonedTime = toZonedTime(new Date(expiresAt), "America/Fortaleza");
      return format(zonedTime, "dd/MM/yyyy 'às' HH:mm");
    };

    const groupedActivities = {} as Record<number, { title: string; type: string; description: string; expiresAt: Date | null; users: string[] }>;

    for (const activity of activities) {
      const activityId = activity.activity_id;
      if (!groupedActivities[activityId]) {
        groupedActivities[activityId] = {
          title: activity.title,
          type: activity.type,
          description: activity.description,
          expiresAt: activity.expires_at,
          users: [],
        };
      }

      if (activity.user_id && activity.date_completed) {
        const userDisplay = `${activity.enrollment || "Desconhecido"} (<@${activity.user_id}>)`;
        groupedActivities[activityId].users.push(userDisplay);
      }
    }

    const totalActivities = Object.keys(groupedActivities).length;
    const maxPage = Math.ceil(totalActivities / ACTIVITIES_PER_PAGE) - 1;

    const paginatedActivities = Object.entries(groupedActivities)
      .slice(page * ACTIVITIES_PER_PAGE, (page + 1) * ACTIVITIES_PER_PAGE)
      .map(([id, activity]) => {
        let usersList = activity.users.slice(0, MAX_USERS_DISPLAY).join(", ");
        if (activity.users.length > MAX_USERS_DISPLAY) {
          usersList += ` e mais ${activity.users.length - MAX_USERS_DISPLAY}...`;
        }

        return (
          `**${activity.title}**\n` +
          `🆔 ID: ${id}\n` +
          `📚 **Tipo:** ${activity.type}\n` +
          `📅 **Expira em:** ${formatExpiresAt(activity.expiresAt)}\n` +
          `✏️ **Descrição:** ${activity.description}\n` +
          `👥 **Completaram:** ${usersList || "Nenhum"}`
        );
      })
      .join("\n\n");

    const embed = createEmbed({
      title: "📋 Lista de Atividades",
      description: paginatedActivities || "Nenhuma atividade encontrada nesta página.",
      footer: { text: `Página ${page + 1}` },
      color: "Blue",
    });

    const row = createRow(
      new ButtonBuilder()
        .setCustomId(
          page === 0 ? `list_activities/disabled_previous` : `list_activities/${Math.max(page - 1, 0)}`
        )
        .setLabel("⬅️ Anterior")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(
          page === maxPage ? `list_activities/disabled_next` : `list_activities/${Math.min(page + 1, maxPage)}`
        )
        .setLabel("Próximo ➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= maxPage)
    );

    await interaction.update({ embeds: [embed], components: [row] });
  },
});