import { Responder, ResponderType } from "#base";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { createEmbed, createRow } from "@magicyan/discord";
import { query } from "#database";

const USERS_PER_PAGE = 5;

export default new Responder({
  customId: "rank/:page",
  type: ResponderType.Button,
  parse: (params) => {
    const page = parseInt(params.page, 10);
    return { page: isNaN(page) ? 0 : page };
  },
  async run(interaction, { page }) {
    const users = await query(`
      SELECT
        u.id,
        u.enrollment,
        u.level,
        u.xp,
        u.streak,
        u.max_streak,
        COUNT(ua.id) AS activities_completed,
        COALESCE(SUM(CASE WHEN ua.user_id = first_submitters.first_user THEN 1 ELSE 0 END), 0) AS early_submission_score
      FROM users u
      LEFT JOIN user_activities ua ON ua.user_id = u.id AND ua.date_completed IS NOT NULL
      LEFT JOIN (
        SELECT activity_id, MIN(submission_date) AS first_submission, MIN(user_id) AS first_user
        FROM user_activities
        WHERE submission_date IS NOT NULL
        GROUP BY activity_id
      ) first_submitters ON ua.activity_id = first_submitters.activity_id
      GROUP BY u.id
      ORDER BY
        u.level DESC,
        u.xp DESC,
        activities_completed DESC,
        u.max_streak DESC,
        u.streak DESC,
        early_submission_score DESC;
    `);

    if (!users.length) {
      await interaction.editReply({
        content: "Nenhum usuário encontrado.",
      });
      return;
    }

    const guildMembers = await interaction.guild?.members.fetch();

    const usersWithJoinDate = users.map(user => {
      const member = guildMembers?.get(user.id);
      return {
        ...user,
        joinedAt: member?.joinedTimestamp || Infinity
      };
    });

    usersWithJoinDate.sort((a, b) =>
      b.level - a.level ||
      b.xp - a.xp ||
      b.activities_completed - a.activities_completed ||
      b.max_streak - a.max_streak ||
      b.streak - a.streak ||
      b.early_submission_score - a.early_submission_score ||
      a.joinedAt - b.joinedAt
    );

    const start = page * USERS_PER_PAGE;
    const pageUsers = usersWithJoinDate.slice(start, start + USERS_PER_PAGE);

    const description = pageUsers.map((user, index) => {
      const rank = start + index + 1;
      const member = guildMembers?.get(user.id);
      const memberName = member?.nickname || member?.user?.globalName || "Usuário Anônimo";

      return `#${rank} **${memberName}** (${user.enrollment})\n`
        + `🎯 **Nível:** ${user.level}\n`
        + `✨ **XP:** ${user.xp}\n`
        + `📘 **Atividades Completadas:** ${user.activities_completed}\n`
        + `🔥 **Maior Streak:** ${user.max_streak}\n`
        + `⚡ **Streak Atual:** ${user.streak}\n`
        + `🏅 **Entregas em 1º Lugar:** ${user.early_submission_score}`;
    }).join("\n\n");

    const maxPage = Math.ceil(usersWithJoinDate.length / USERS_PER_PAGE) - 1;

    const embed = createEmbed({
      title: "🏆 Ranking dos Melhores Alunos",
      description: description || "Nenhum usuário encontrado nesta página.",
      footer: { text: `Página ${page + 1} de ${maxPage + 1}` },
      color: "Gold",
    });

    const row = createRow(
      new ButtonBuilder()
        .setCustomId(page === 0 ? "rank/disabled_previous" : `rank/${Math.max(page - 1, 0)}`)
        .setLabel("⬅️ Anterior")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(page === maxPage ? "rank/disabled_next" : `rank/${Math.min(page + 1, maxPage)}`)
        .setLabel("Próximo ➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === maxPage)
    );

    await interaction.update({
      content: "",
      embeds: [embed],
      components: [row],
    });
  },
});
