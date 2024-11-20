import { Events } from 'discord.js';
import { collectSequentialReactions, collectSequentialResponses, sendDM } from '../utils/interactionHandlers.js';
import { createEmbed, deleteMessage } from '../utils/messageUtils.js';
import UserService from '../services/userService.js';

export default {
  once: false,
  event: Events.GuildMemberAdd,
  async execute(member) {
    if (!member) return;

    const welcomeChannel = member.guild.channels.cache.get('1298472460156403752');
    if (!welcomeChannel) return;

    try {
      const dmChannel = await sendDM(member, welcomeChannel, {
        embeds: [
          createEmbed({
            title: `Boas-vindas ao servidor ${member.guild.name}!`,
            description: `Olá! Seja bem-vindo ao ! Para começar, por favor, responda algumas perguntas!`,
            color: '5555FF',
            author: member.guild
          }),
        ],
      });

      if (!dmChannel) {
        await welcomeChannel.send({
          content: `${member}`,
          embeds: [
            createEmbed({
              title: 'Erro',
              description: 'Não foi possível enviar a mensagem para você. Habilite suas mensagens privadas e relogue no servidor.',
              color: 'ff5555',
            }),
          ],
        }).then(deleteMessage);

        return;
      }

      await welcomeChannel.send({
        content: `${member}`,
        embeds: [
          createEmbed({
            title: '⚠️ Atenção',
            description: 'Enviei uma mensagem privada para você. Por favor, responda as perguntas para continuar.',
            color: 'FFFF55',
          }),
        ],
      }).then(message => deleteMessage(message, 15000));

      const reactionQuestions = [
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
      ];

      const reactionAnswers = await collectSequentialReactions(member, dmChannel, reactionQuestions);
      if (!reactionAnswers) return;

      const responseQuestions = [
        {
          key: 'enrollment',
          question: 'Qual é o seu número de matrícula?',
          validate: answer => answer.length >= 6,
        }
      ];

      const responseAnswers = await collectSequentialResponses(member, dmChannel, responseQuestions);
      if (!responseAnswers) return;

      const userService = new UserService();
      await userService.addUser(member.id, {
        enrollment: responseAnswers.enrollment,
        character: reactionAnswers.character === '👨' ? 'Finn' : 'Jake',
        xp: 0,
        level: 1,
        role: 'Aprendiz de Algoritmos',
        activityHistory: [],
        streak: 0,
        maxStreak: 0,
        lastActivity: null,
        badges: [],
      });

      const role = member.guild.roles.cache.find(role => role.id === (reactionAnswers.role === '💻' ? '1298472443362414694' : '1298472445560360960'));
      await member.roles.add(role);

      await dmChannel.send({
        content: `${member}`,
        embeds: [
          createEmbed({
            title: 'Perfil criado com sucesso',
            author: member.user,
            description: `Nome: ${member.user.username}\nMatrícula: ${responseAnswers.enrollment}\nPersonagem: ${reactionAnswers.character === '👨' ? 'Finn' : 'Jake'}\nCurso: ${reactionAnswers.role === '💻' ? 'Ciência da Computação' : 'Engenharia de Software'}`,
            footer: {
              content: 'Seu perfil foi criado com sucesso. Tenha um excelente aprendizado na disciplina.',
              iconURL: member.guild.iconURL({ dynamic: true }),
            },
            color: '55FF55',
          }),
        ],
      });

      await member.setNickname(`${reactionAnswers.character} ${member.user.username}`);
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
    }
  },
};
