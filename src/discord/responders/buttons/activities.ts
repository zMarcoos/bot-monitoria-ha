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
    const ACTIVITIES_PER_PAGE = 5;

    const start = page * ACTIVITIES_PER_PAGE;
    const activities = await query(
      `
      SELECT
        a.id AS activity_id,
        a.title,
        a.type,
        a.expires_at,
        u.id AS user_id,
        u.enrollment,
        u.course,
        u.role
      FROM activities a
      LEFT JOIN user_activities ua ON a.id = ua.activity_id
      LEFT JOIN users u ON ua.user_id = u.id
      ORDER BY a.id ASC
      LIMIT $1 OFFSET $2
      `,
      [ACTIVITIES_PER_PAGE, start]
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

    const groupedActivities: Record<number, { title: string; type: string; expiresAt: Date | null; users: string[] }> =   {};

    for (const activity of activities) {
      const activityId = activity.activity_id;
      if (!groupedActivities[activityId]) {
        groupedActivities[activityId] = {
          title: activity.title,
          type: activity.type,
          expiresAt: activity.expires_at,
          users: [],
        };
      }

      if (activity.user_id) {
        const userDisplay = `${activity.enrollment || "Desconhecido"} (<@${activity.user_id}>)`;
        groupedActivities[activityId].users.push(userDisplay);
      }
    }

    const description = Object.entries(groupedActivities)
      .map(
        ([id, activity]) =>
          `**#${id} - ${activity.title}**\n` +
          `📚 **Tipo:** ${activity.type}\n` +
          `📅 **Expira em:** ${formatExpiresAt(activity.expiresAt)}\n` +
          `👥 **Completaram:** ${activity.users.join(", ") || "Nenhum"}`
      )
      .join("\n\n");

    const embed = createEmbed({
      title: "📋 Lista de Atividades",
      description: description || "Nenhuma atividade encontrada nesta página.",
      footer: { text: `Página ${page + 1}` },
      color: "Blue",
    });

    const maxPage = Math.ceil(activities.length / ACTIVITIES_PER_PAGE) - 1;

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
        .setDisabled(page === maxPage)
    );

    await interaction.update({ embeds: [embed], components: [row] });
  },
});
