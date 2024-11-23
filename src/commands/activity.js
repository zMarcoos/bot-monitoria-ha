import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import ActivityService from '../database/services/activityService.js';
import UserService from '../database/services/userService.js';
import { createEmbed, getRandomAdventureImage } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import { getMember } from '../utils/userUtils.js';
import { parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

            const userNames = await Promise.all((activity.completed).map(async (userId) => {
                try {
                  const member = await getMember(userId);
                  return `${member.nickname || member.user.globalName} (${member})`;
                } catch (error) {
                  console.error(`Erro ao buscar membro ${userId}:`, error);
                  return `Usuário desconhecido (${userId})`;
                }
              })
            );

            embed.addFields({
              name: 'Usuários:',
              value: userNames.length > 0 ? userNames.join(', ') : 'Nenhum usuário completou'
            });

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
