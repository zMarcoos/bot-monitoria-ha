import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { parse, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { getMember } from '../utils/userUtils.js';
import { createPaginationCollector } from '../utils/interactionHandlers.js';
import Command from './interface/command.js';
import ActivityService from '../database/services/activityService.js';
import CustomError from '../exceptions/customError.js';
import UserService from '../database/services/userService.js';

const ACTIVITIES_PER_PAGE = 5;
const MONITOR_ROLE_ID = '1298472442565623818';
const ACTIVITY_CHANNEL_ID = '1309657893460512902';

const userService = new UserService();
const activityService = new ActivityService();

async function resolveUserNames(userIds) {
  const cache = new Map();

  const names = await Promise.all(
    userIds.map(async (userId) => {
      if (cache.has(userId)) {
        return cache.get(userId);
      }

      try {
        const [user, member] = await Promise.all([
          userService.getUser(userId),
          getMember(userId)
        ]);

        const userName = member?.user.tag || 'Desconhecido';
        const enrollment = user?.enrollment || '';

        const result = `${userName} (${enrollment})`.trim() || 'Usuário desconhecido';
        cache.set(userId, result);
        return result;
      } catch (error) {
        return 'Usuário desconhecido';
      }
    })
  );

  return names.join(', ') || 'Nenhum';
}


export default new Command({
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
            ))
        .addStringOption(option =>
          option.setName('date')
            .setDescription('Data de entrega da atividade (padrão dia/mês/ano hora:minuto)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('submeter')
        .setDescription('Submeter a atividade do estudante')
        .addStringOption(option =>
          option.setName('activity_id')
            .setDescription('ID da atividade')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('response')
            .setDescription('Texto de resposta da atividade')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('listar')
        .setDescription('Listar todas as atividades e os usuários que as completaram')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'adicionar': {
        const member = interaction.member;

        if (!member.roles.cache.some(role => role.id === MONITOR_ROLE_ID)) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Você não tem permissão para executar este comando.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true,
          });
          return;
        }

        const title = interaction.options.getString('title');
        const type = interaction.options.getString('type');
        const date = interaction.options.getString('date');

        const dateRegex = /^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4} ([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!dateRegex.test(date)) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Data inválida. Utilize o formato dia/mês/ano hora:minuto.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true,
          });
          return;
        }

        const deadline = parse(date, 'dd/MM/yyyy HH:mm', new Date());
        if (deadline < new Date()) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'A data de entrega da atividade não pode ser no passado.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true,
          });

          return;
        }

        await activityService.addActivity({ title, type, deadline });
        await interaction.editReply({
          content: `Atividade "${title}" do tipo "${type}" para até a data "${deadline}" adicionada com sucesso.`,
          ephemeral: true,
        });

        break;
      }

      case 'submeter': {
        const activityId = interaction.options.getString('activity_id');
        const response = interaction.options.getString('response')?.trim();

        if (!response) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'A resposta não pode estar vazia.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true,
          });
          return;
        }

        const activity = await activityService.getActivity(activityId);
        if (!activity) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Atividade inválida.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true,
          });
          return;
        }

        const userId = interaction.user.id;
        const activityChannel = interaction.guild.channels.cache.get(ACTIVITY_CHANNEL_ID);

        const alreadySubmitted = activity.pending.some(submission => submission.userId === userId);
        if (alreadySubmitted) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Submissão duplicada',
                description: 'Você já submeteu uma resposta para esta atividade e ela está pendente de aprovação.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true,
          });
          return;
        }

        await activityService.addPendingResponse(activityId, {
          userId,
          submissionDate: new Date(),
          content: response,
        });

        const message = await activityChannel.send({
          embeds: [
            createEmbed({
              title: 'Nova submissão',
              description: `Nova submissão para a atividade "${activity.title}" de ${interaction.user.tag}.`,
              color: EMBED_COLORS.BLUE,
              fields: [
                { name: 'ID da atividade:', value: activityId },
                { name: 'Resposta:', value: response },
                { name: 'Data submissão:', value: new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }) },
              ],
              footer: {
                text: interaction.user.id,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
              }
            })
          ]
        });

        await message.react('✅');
        await message.react('❌');

        await interaction.editReply({
          embeds: [
            createEmbed({
              author: { name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
              title: 'Submissão realizada',
              description: `Sua resposta foi enviada para a atividade "${activity.title}" e está pendente de aprovação.`,
              color: EMBED_COLORS.GREEN,
            })
          ]
        });

        break;
      }

      case 'listar': {
        const activities = await activityService.listActivities();

        if (!activities.length) {
          await interaction.editReply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Nenhuma atividade encontrada.',
                color: EMBED_COLORS.RED,
              }),
            ],
          });
          return;
        }

        const formatDeadline = (deadline) => {
          try {
            const deadlineDate = deadline.toDate();
            return format(deadlineDate, "dd/MM/yyyy HH:mm '(Horário de Brasília)'", { locale: ptBR });
          } catch (error) {
            console.error('Erro ao formatar a data:', error.message);
            return 'Data inválida ou não informada';
          }
        };

        const generateEmbed = async (page) => {
          const start = page * ACTIVITIES_PER_PAGE;
          const end = start + ACTIVITIES_PER_PAGE;
          const pageActivities = activities.slice(start, end);

          const description = await Promise.all(
            pageActivities.map(async (activity, _) => {
              const users = await resolveUserNames(activity.completed.map(data => data.userId));

              return `**#${activity.id} - ${activity.title}**\n`
                + `📚 **Tipo:** ${activity.type}\n`
                + `📅 **Prazo:** ${formatDeadline(activity.deadline) || 'Não informado'}\n`
                + `👥 **Completaram:** ${users}`;
            })
          ).then((lines) => lines.join('\n\n'));

          return new EmbedBuilder()
            .setTitle('📋 Lista de Atividades')
            .setDescription(description || 'Nenhuma atividade encontrada nesta página.')
            .setFooter({ text: `Página ${page + 1} de ${Math.ceil(activities.length / ACTIVITIES_PER_PAGE)}` })
            .setColor(EMBED_COLORS.BLUE);
        };

        const initialEmbed = await generateEmbed(0);

        await createPaginationCollector({
          interaction,
          initialEmbed,
          totalItems: activities.length,
          itemsPerPage: ACTIVITIES_PER_PAGE,
          generateEmbed,
        });

        break;
      }
    }
  },
});
