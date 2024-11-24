import { Events } from 'discord.js';
import { collectSequentialReactions, collectSequentialResponses, sendDM } from '../utils/interactionHandlers.js';
import { createEmbed, deleteMessage } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import UserService from '../database/services/userService.js';
import CustomError from '../exceptions/customError.js';

const QUESTIONS = {
  REACTIONS: [
    {
      key: 'character',
      question: 'Escolha o personagem que vai lhe representar:\n👨 - Finn\n🐶 - Jake\n',
      emojis: ['👨', '🐶'],
    },
    {
      key: 'role',
      question: 'De qual curso você é:\n💻 - Ciência da Computação\n👥 - Engenharia de Software\n',
      emojis: ['💻', '👥'],
    },
  ],
  RESPONSES: [
    {
      key: 'enrollment',
      question: 'Qual é o seu número de matrícula?',
      validate: (answer) => answer.length >= 6,
    },
  ],
};

export default {
  once: false,
  event: Events.GuildMemberAdd,
  async execute(member) {
    if (!member) return;

    const welcomeChannel = member.guild.channels.cache.get('1298472460156403752');
    if (!welcomeChannel) {
      console.log('Canal de boas-vindas não encontrado!');
      return;
    }

    try {
      const dmChannel = await sendDM(member, welcomeChannel, {
        embeds: [
          createEmbed({
            title: `Boas-vindas ao servidor ${member.guild.name}!`,
            description: `Olá! Seja bem-vindo ao servidor! Para começar, por favor, responda algumas perguntas!`,
            color: EMBED_COLORS.BLUE,
            author: member.guild,
          }),
        ],
      });

      if (!dmChannel) {
        console.log(`Não foi possível enviar mensagem privada para ${member.user.tag}!`);
        return;
      }

      await welcomeChannel.send({
        content: `${member}`,
        embeds: [
          createEmbed({
            title: '⚠️ Atenção',
            description: 'Enviei uma mensagem privada para você. Por favor, responda as perguntas para continuar.',
            color: EMBED_COLORS.YELLOW,
          }),
        ],
      }).then((message) => deleteMessage(message, 30000));

      const notResponseMessage = createEmbed({
        title: 'Perguntas não respondidas',
        description: 'Você não respondeu às perguntas. Por favor, tente novamente.',
        color: EMBED_COLORS.RED,
      });

      const reactionAnswers = await collectSequentialReactions(member, dmChannel, QUESTIONS.REACTIONS);
      if (!reactionAnswers) {
        dmChannel.send({
          content: `${member}`,
          embeds: [notResponseMessage],
        });
        return;
      }

      const responseAnswers = await collectSequentialResponses(member, dmChannel, QUESTIONS.RESPONSES);
      if (!responseAnswers) {
        dmChannel.send({
          content: `${member}`,
          embeds: [notResponseMessage],
        });
        return;
      }

      const character = reactionAnswers.character === '👨' ? 'Finn' : 'Jake';

      const userService = new UserService();
      await userService.addUser(member.id, {
        enrollment: responseAnswers.enrollment,
        character,
        xp: 0,
        level: 0,
        role: 'Aprendiz de Algoritmos',
        activityHistory: [],
        streak: 0,
        maxStreak: 0,
        lastActivity: null,
        badges: [],
      });

      const role = member.guild.roles.cache.get(reactionAnswers.role === '💻' ? '1298472443362414694' : '1298472445560360960');
      if (!role) {
        console.log(`Cargo não encontrado para atribuir ao usuário ${member.user.tag} que entrou no servidor.`);
        return;
      }

      await member.roles.add(role);
      await dmChannel.send({
        content: `${member}`,
        embeds: [
          createEmbed({
            title: 'Perfil criado com sucesso',
            author: member.user,
            description: `Nome: ${member.user.username}\nMatrícula: ${responseAnswers.enrollment}\nPersonagem: ${character}\nCurso: ${role.name}`,
            footer: {
              text: 'Seu perfil foi criado com sucesso. Tenha um excelente aprendizado na disciplina.',
              iconURL: member.guild.iconURL({ dynamic: true }),
            },
            color: EMBED_COLORS.GREEN,
          }),
        ],
      });

      await member.setNickname(`${reactionAnswers.character} ${member.user.username}`);
    } catch (error) {
      CustomError.logger(error, 'guildMemberAdd');
    }
  },
};