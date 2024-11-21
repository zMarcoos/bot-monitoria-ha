import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import ActivityService from '../services/activityService.js';
import UserService from '../database/services/userService.js';

const activityService = new ActivityService();
const userService = new UserService();

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('atividade')
    .setDescription('Gerenciar atividades')
    .addSubcommand(subcommand =>
      subcommand
        .setName('adicionar')
        .setDescription('Adicionar uma nova atividade')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Título da atividade')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Tipo de atividade')
            .setRequired(true)
            .addChoices(
              { name: 'Prático', value: 'pratico' },
              { name: 'Desafio', value: 'desafio' },
              { name: 'Trabalho', value: 'trabalho' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('vincular')
        .setDescription('Vincular uma atividade a um estudante')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Usuário a vincular')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('activity_id')
            .setDescription('ID da atividade')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('listar')
        .setDescription('Listar todas as atividades e os usuários que as completaram')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'adicionar' || subcommand === 'vincular') {
      const member = interaction.member;

      if (!member.roles.cache.some(role => role.id === '1298472442565623818')) {
        await interaction.reply({ content: 'Você não tem permissão para executar este comando.', ephemeral: true });
        return;
      }
    }

    const userId = interaction.options.getUser('user')?.id;
    const activityId = interaction.options.getString('activity_id');

    switch (subcommand) {
      case 'adicionar': {
        const title = interaction.options.getString('title');
        const type = interaction.options.getString('type');

        await activityService.addActivity({ title, type, completedBy: [], createdAt: new Date() });
        await interaction.reply(`Atividade "${title}" do tipo "${type}" adicionada com sucesso.`);
        break;
      }

      case 'vincular': {
        await userService.addActivityToUser(userId, activityId);
        await interaction.reply({ content: 'Atividade processada com sucesso.', ephemeral: true });
        break;
      }

      case 'listar': {
        const activities = await activityService.listActivities();

        if (!activities.length) {
          await interaction.reply('Nenhuma atividade encontrada.');
          return;
        }

        const activityEmbeds = await Promise.all(
          activities.map(async (activity) => {
            const embed = new EmbedBuilder()
              .setTitle(activity.title)
              .setDescription(`ID: ${activity.id}\nTipo: ${activity.type}`)
              .setColor('#0099ff');

            const userNames = await Promise.all(
              activity.completedBy.map(async userId => {
                const user = await userService.getUser(userId);
                const userName = user ? user.name : 'Usuário desconhecido';
                return `${userName} (${interaction.guild.members.cache.get(userId)})`;
              })
            );

            embed.addFields({ name: 'Usuários:', value: userNames.join(', ') || 'Nenhum usuário completou' });
            return embed;
          })
        );

        await interaction.reply({ embeds: activityEmbeds });
        break;
      }

      default:
        await interaction.reply('Comando inválido.');
        break;
    }
  },
};
