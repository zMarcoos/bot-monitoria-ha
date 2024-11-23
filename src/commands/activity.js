import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import ActivityService from '../database/services/activityService.js';
import UserService from '../database/services/userService.js';
import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { getMember } from '../utils/userUtils.js';
import { parse, format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTIVITIES_PER_PAGE = 5;
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
            ))
        .addStringOption(option =>
          option.setName('date')
            .setDescription('Data de entrega da atividade (padrão dia/mes/ano hora:minuto)')
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

        const title = interaction.options.getString('title');
        const type = interaction.options.getString('type');
        const date = interaction.options.getString('date');

        const dateRegex = /^([0-2][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4} ([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!dateRegex.test(date)) {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Data inválida. Utilize o formato dia/mês/ano hora:minuto.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true
          });
          return;
        }

        const deadline = parse(date, 'dd/MM/yyyy HH:mm', new Date());

        await activityService.addActivity({ title, type, deadline });
        await interaction.reply({
          content: `Atividade "${title}" do tipo "${type}" para até a data "${deadline}" adicionada com sucesso.`,
          ephemeral: true,
        });

        break;
      }

      case 'submeter': {
        const activityId = interaction.options.getString('activity_id');
        let response = interaction.options.getString('response')?.trim();

        if (!response) {
          await interaction.reply({
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
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Atividade inválida.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true
          });
          return;
        }

        const userId = interaction.user.id;
        const activityChannel = interaction.guild.channels.cache.get('1309657893460512902');

        const alreadySubmitted = activity.pending.some(submission => submission.userId === userId);
        if (alreadySubmitted) {
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Submissão duplicada',
                description: 'Você já submeteu uma resposta para esta atividade e ela está pendente de aprovação.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true
          });
          return;
        }

        try {
          await activityService.addPendingResponse(activityId, {
            userId,
            submissionDate: new Date(),
            content: response,
          });

          const message = await activityChannel.send({
            embeds: [
              createEmbed({
                title: 'Nova submissão',
                description: `Nova submissão para a atividade "${activity.title}" de ${interaction.user} (${interaction.user.tag}).`,
                color: EMBED_COLORS.BLUE,
                fields: [
                  { name: 'ID da atividade:', value: activityId },
                  { name: 'Resposta:', value: response },
                  { name: 'Data submissão:', value: new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }) },
                ],
                footer: { text: userId, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
              })
            ]
          });

          await message.react('✅');
          await message.react('❌');

          await interaction.reply({
            embeds: [
              createEmbed({
                author: { name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) },
                title: 'Submissão realizada',
                description: `Sua resposta foi enviada para a atividade "${activity.title}" e está pendente de aprovação.`,
                color: EMBED_COLORS.GREEN,
              })
            ],
            ephemeral: true,
          });
        } catch (error) {
          console.error('Erro ao submeter resposta:', error);
          await interaction.reply({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Não foi possível submeter sua resposta. Tente novamente mais tarde.',
                color: EMBED_COLORS.RED,
              })
            ],
            ephemeral: true,
          });
        }
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
              }),
            ],
            ephemeral: true,
          });
          return;
        }

        let currentPage = 0;

        const createPageEmbed = async (page) => {
          const start = page * ACTIVITIES_PER_PAGE;
          const end = start + ACTIVITIES_PER_PAGE;
          const pageActivities = activities.slice(start, end);

          const description = await Promise.all(
            pageActivities.map(async (activity, index) => {
              const users = await Promise.all(
                (activity.completed || []).map(async (data) => {
                  const user = await userService.getUser(data.userId);

                  try {
                    const member = await getMember(data.userId);
                    return `${user.globalName || member.user.tag} (${user.enrollment})`;
                  } catch {
                    return `Usuário desconhecido (${user.enrollment})`;
                  }
                })
              );

              let formattedDeadline;
              try {
                const deadlineDate = activity.deadline.toDate();
                formattedDeadline = isValid(deadlineDate)
                  ? format(deadlineDate, "dd/MM/yyyy HH:mm '(Horário de Fortaleza)'", { locale: ptBR })
                  : 'Data inválida';
              } catch (error) {
                console.error('Erro ao formatar data:', error);
                formattedDeadline = 'Data inválida';
              }

              return `**#${activity.id} - ${activity.title}**\n`
                + `🆔 **ID:** ${activity.id}\n`
                + `📚 **Tipo:** ${activity.type}\n`
                + `📅 **Prazo:** ${formattedDeadline}\n`
                + `👥 **Usuários que completaram:** ${users.length > 0 ? users.join(', ') : 'Nenhum'}`;
            })
          ).then(lines => lines.join('\n\n'));

          return new EmbedBuilder()
            .setTitle('📋 Lista de Atividades')
            .setDescription(description || 'Nenhuma atividade encontrada nesta página.')
            .setFooter({ text: `Página ${page + 1} de ${Math.ceil(activities.length / ACTIVITIES_PER_PAGE)}` })
            .setColor(EMBED_COLORS.BLUE);
        };

        const createButtons = (page) => {
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('⬅️ Anterior')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
              new ButtonBuilder()
                .setCustomId('next')
                .setLabel('➡️ Próximo')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === Math.ceil(activities.length / ACTIVITIES_PER_PAGE) - 1),
            );
          return row;
        };

        const initialEmbed = await createPageEmbed(currentPage);
        const buttons = createButtons(currentPage);

        const message = await interaction.reply({
          embeds: [initialEmbed],
          components: [buttons],
          fetchReply: true,
        });

        const collector = message.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (btnInteraction) => {
          if (btnInteraction.user.id !== interaction.user.id) {
            await btnInteraction.reply({
              content: 'Apenas o usuário que usou o comando pode interagir.',
              ephemeral: true,
            });
            return;
          }

          try {
            if (btnInteraction.customId === 'prev') {
              currentPage -= 1;
            } else if (btnInteraction.customId === 'next') {
              currentPage += 1;
            }

            const updatedEmbed = await createPageEmbed(currentPage);
            const updatedButtons = createButtons(currentPage);

            await btnInteraction.update({
              embeds: [updatedEmbed],
              components: [updatedButtons],
            });
          } catch (error) {
            console.error('Erro ao processar interação:', error);
            if (error.code === 10008) {
              await btnInteraction.reply({
                content: 'A mensagem original foi deletada e a interação foi encerrada.',
                ephemeral: true,
              });
            }
          }
        });

        collector.on('end', async () => {
          try {
            const disabledButtons = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('prev')
                  .setLabel('⬅️ Anterior')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId('next')
                  .setLabel('➡️ Próximo')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(true),
              );

            await message.edit({
              components: [disabledButtons],
            });
          } catch (error) {
            console.error('Erro ao desativar botões:', error);
            if (error.code === 10008) {
              console.log('Mensagem já foi deletada. Nenhuma ação necessária.');
            }
          }
        });

        break;
      }

      default:
        await interaction.reply('Comando inválido.');
        break;
    }
  },
};
