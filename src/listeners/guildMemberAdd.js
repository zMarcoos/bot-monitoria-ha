import { Events } from 'discord.js';
import { collectSequentialReactions, collectSequentialResponses, sendDM } from '../utils/interactionHandlers.js';
import { createEmbed, deleteMessage } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import UserService from '../database/services/userService.js';
import CustomError from '../exceptions/customError.js';

const WELCOME_CHANNEL_ID = '1298472460156403752';
const INITIAL_LEVEL_ROLE_ID = '1309353021490200627';

const MAPPINGS = {
  characters: {
    Finn: { emoji: '👨' },
    Jake: { emoji: '🐶' },
  },
  courses: {
    '💻': { name: 'Ciência da Computação', roleId: '1298472443362414694' },
    '👥': { name: 'Engenharia de Software', roleId: '1298472445560360960' },
  },
};

const QUESTIONS = {
  REACTIONS: [
    {
      key: 'character',
      question: 'Escolha o personagem que vai lhe representar:\n👨 - Finn\n🐶 - Jake\n',
      emojis: Object.values(MAPPINGS.characters).map((char) => char.emoji),
    },
    {
      key: 'role',
      question: 'De qual curso você é:\n💻 - Ciência da Computação\n👥 - Engenharia de Software\n',
      emojis: Object.keys(MAPPINGS.courses),
    },
  ],
  RESPONSES: [
    {
      key: 'enrollment',
      question: 'Digite e envie no chat o seu número de matrícula.',
      validate: (answer) => answer.length >= 6,
    },
  ],
};

const userService = new UserService();

function getCharacterEmojiByName(name) {
  return MAPPINGS.characters[name]?.emoji || null;
}

function getCourseEmojiByName(name) {
  return Object.keys(MAPPINGS.courses).find(
    (key) => MAPPINGS.courses[key].name === name
  );
}

function getCourseDetails(emoji) {
  return MAPPINGS.courses[emoji];
}

async function assignRoleAndNickname(member, courseName, characterName) {
  const courseEmoji = getCourseEmojiByName(courseName);
  const characterEmoji = getCharacterEmojiByName(characterName);

  if (!courseEmoji || !characterEmoji) {
    console.log(`Detalhes inválidos: curso ${courseName}, personagem ${characterName}`);
    return;
  }

  const course = MAPPINGS.courses[courseEmoji];
  const role = member.guild.roles.cache.get(course.roleId);
  const initialRole = member.guild.roles.cache.get(INITIAL_LEVEL_ROLE_ID);

  if (!role || !initialRole) {
    console.log(`Cargo não encontrado para o usuário ${member.user.tag}.`);
    return;
  }

  await member.roles.add([role, initialRole]);
  await member.setNickname(`${characterEmoji} ${member.user.username}`);
}

async function handleUnansweredQuestions(dmChannel, member) {
  const notResponseMessage = createEmbed({
    title: 'Perguntas não respondidas',
    description: 'Você não respondeu às perguntas. Por favor, tente novamente.',
    color: EMBED_COLORS.RED,
  });

  await dmChannel.send({
    content: `${member}`,
    embeds: [notResponseMessage],
  });
}

export default {
  once: false,
  event: Events.GuildMemberAdd,
  async execute(member) {
    if (!member) return;

    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!welcomeChannel) {
      console.log('Canal de boas-vindas não encontrado!');
      return;
    }

    try {
      const user = await userService.getUser(member.id);
      if (user) {
        await assignRoleAndNickname(member, user.course, user.character);
        return;
      }

      const dmChannel = await sendDM(member, welcomeChannel, {
        embeds: [
          createEmbed({
            title: `Boas-vindas ao servidor ${member.guild.name}!`,
            description: 'Olá! Seja bem-vindo ao servidor! Para começar, por favor, responda algumas perguntas!',
            color: EMBED_COLORS.BLUE,
            author: member.guild,
          }),
        ],
      });

      if (!dmChannel) {
        console.log(`Não foi possível enviar mensagem privada para ${member.user.tag}.`);
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

      const reactionAnswers = await collectSequentialReactions(member, dmChannel, QUESTIONS.REACTIONS);
      if (!reactionAnswers) {
        await handleUnansweredQuestions(dmChannel, member);
        return;
      }

      const responseAnswers = await collectSequentialResponses(member, dmChannel, QUESTIONS.RESPONSES);
      if (!responseAnswers) {
        await handleUnansweredQuestions(dmChannel, member);
        return;
      }

      const characterName = Object.keys(MAPPINGS.characters).find(
        (name) => MAPPINGS.characters[name].emoji === reactionAnswers.character
      );

      const course = getCourseDetails(reactionAnswers.role);
      if (!characterName || !course) {
        console.log('Detalhes inválidos ao criar perfil.');
        return;
      }

      await userService.addUser(member.id, {
        enrollment: responseAnswers.enrollment,
        course: course.name,
        character: characterName,
        xp: 0,
        level: 0,
        role: 'Aprendiz de Algoritmos',
        activityHistory: [],
        streak: 0,
        maxStreak: 0,
        lastActivity: null,
        badges: [],
      });

      await assignRoleAndNickname(member, course.name, characterName);

      await dmChannel.send({
        content: `${member}`,
        embeds: [
          createEmbed({
            title: '✅ Perfil criado com sucesso',
            author: member.user,
            description: `👤 **Nome**: ${member.user.username}\n🆔 **Matrícula**: ${responseAnswers.enrollment}\n🏷️ **Personagem**: ${characterName}\n📓 **Curso**: ${course.name}`,
            footer: {
              text: 'Seu perfil foi criado com sucesso. Tenha um excelente aprendizado na disciplina.',
              iconURL: member.guild.iconURL({ dynamic: true }),
            },
            color: EMBED_COLORS.GREEN,
          }),
        ],
      });
    } catch (error) {
      CustomError.logger(error, 'guildMemberAdd');
    }
  },
};
