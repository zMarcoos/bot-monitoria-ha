import { Command } from "#base";
import { getAllUsers } from "#database/repositories/userRepository.js";
import { createEmbed, createRow } from "@magicyan/discord";
import { ApplicationCommandType, ButtonBuilder, ButtonStyle } from "discord.js";

new Command({
  name: "rank",
  description: "Comando de rank",
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const users = await getAllUsers();
    if (!users.length) {
      await interaction.editReply({
        embeds: [
          createEmbed({
            title: "Rank",
            description: "Não tem usuários cadastrados ainda.",
            color: "Red",
          }),
        ],
      });
      return;
    }

    const initialPage = 0;
    const row = createRow(
      new ButtonBuilder()
        .setCustomId(`rank/${initialPage}`)
        .setLabel("Clique para listar o ranking")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      content: "Clique no botão abaixo para visualizar o ranking!",
      components: [row],
    });
  },
});
