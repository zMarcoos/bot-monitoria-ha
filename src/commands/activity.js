import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import ActivityService from '../database/services/activityService.js';
import UserService from '../database/services/userService.js';
import { createEmbed, getRandomAdventureImage } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { getMember } from '../utils/userUtils.js';

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
        await interaction.reply({
          embeds: [
            createEmbed({
              title: 'Erro',
              description: 'Você não tem permissão para executar este comando.',
              color: EMBED_COLORS.RED,
            })
          ],
          ephemeral: true
        });
        return;
      }
    }

    switch (subcommand) {
      case 'adicionar': {
        const title = interaction.options.getString('title');
        const type = interaction.options.getString('type');

        await activityService.addActivity({ title, type, completedBy: [], createdAt: new Date() });
        await interaction.reply(`Atividade "${title}" do tipo "${type}" adicionada com sucesso.`);
        break;
      }

      case 'vincular': {
        const userId = interaction.options.getUser('user')?.id;
        if (!userId) {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Usuário inválido.',
                color: EMBED_COLORS.RED,
              })
            ],
          });
          return;
        }

        const user = await userService.getUser(userId);
        if (!user) {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Usuário não encontrado.',
                color: EMBED_COLORS.RED,
              })
            ],
          });
          return;
        }

        const activity = await activityService.getActivity(interaction.options.getString('activity_id'));
        if (!activity) {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Atividade inválida.',
                color: EMBED_COLORS.RED,
              })
            ],
          });
          return;
        }

        const previousLevel = user.level;

        const data = await userService.addActivityToUser(userId, activity);
        if (!data) {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Não foi possível vincular a atividade.',
                color: EMBED_COLORS.RED,
              })
            ],
          });
          return;
        }

        const member = await getMember(userId);
        const channel = interaction.guild.channels.cache.get('1298472452955045929');

        channel.send({
          embeds: [
            createEmbed({
              title: 'Atividade completada',
              description: `🎉 ${member.nickname || member.user.globalName} completou a atividade "${activity.title}"! 🎉`,
              color: EMBED_COLORS.GREEN,
              image: getRandomAdventureImage().url,
            })
          ],
        });

        if (previousLevel < data.level) {
          try {
            const role = interaction.guild.roles.cache.get(data.role.id);
            await member.roles.add(role);

            await channel.send({
              embeds: [
                createEmbed({
                  title: 'Level up!',
                  description: `🎉 ${member.nickname || member.user.globalName} subiu para o nível ${data.level}! 🎉`,
                  color: EMBED_COLORS.GREEN,
                  image: getRandomAdventureImage().url,
                })
              ],
            })
          } catch (error) {
            console.error('Erro ao enviar mensagem de atividade:', error);
          }
        }

        await interaction.reply({
          embeds: [
            createEmbed({
              title: 'Atividade vinculada',
              description: `Atividade "${activity.title}" vinculada ao usuário ${interaction.guild.members.cache.get(userId)}`,
              color: EMBED_COLORS.GREEN,
            })
          ],
        });
        break;
      }

      case 'listar': {
        const activities = await activityService.listActivities();

        if (!activities.length) {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Nenhuma atividade encontrada.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true
          });
          return;
        }

        const activityEmbeds = await Promise.all(
          activities.map(async (activity) => {
            const embed = new EmbedBuilder()
              .setTitle(activity.title)
              .setDescription(`ID: ${activity.id}\nTipo: ${activity.type}`)
              .setColor('#0099ff');

            const userNames = await Promise.all(
              activity.completedBy.map(async (userId) => {
                const member = await getMember(userId);
                return `${member.nickname || member.user.globalName} (${member})`;
              })
            );

            embed.addFields({ name: 'Usuários:', value: userNames.join(', ') || 'Nenhum usuário completou' });
            return embed;
          })
        );

        await interaction.reply({ embeds: activityEmbeds, ephemeral: true });
        break;
      }

      default:
        await interaction.reply('Comando inválido.');
        break;
    }
  },
};
