import { Events, PermissionsBitField } from 'discord.js';
import { collectSequentialReactions, collectSequentialResponses } from '../utils/interactionHandlers.js';
import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';
import UserService from '../database/services/userService.js';
import CustomError from '../exceptions/customError.js';

const userService = new UserService();

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

async function createPrivateChannel(guild, member) {
  return await guild.channels.create({
    name: `registro-${member.user.username}`,
    type: 0,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ],
  });
}

async function assignRoleAndNickname(member, courseName, characterName) {
  const courseEmoji = Object.keys(MAPPINGS.courses).find(
    (key) => MAPPINGS.courses[key].name === courseName
  );
  const characterEmoji = MAPPINGS.characters[characterName]?.emoji;

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

export default {
  once: false,
  event: Events.GuildMemberAdd,
  async execute(member) {
    if (!member) return;

    const guild = member.guild;

    try {
      const user = await userService.getUser(member.id);
      if (user) {
        await assignRoleAndNickname(member, user.course, user.character);
        return;
      }

      const channel = await createPrivateChannel(guild, member);
      if (!channel) {
        console.log('Canal privado não encontrado!');
        return;
      }

      await channel.send({
        embeds: [
          createEmbed({
            title: `Boas-vindas ao servidor ${guild.name}!`,
            description: 'Olá! Para começar, por favor, responda algumas perguntas abaixo:',
            color: EMBED_COLORS.BLUE,
            author: guild,
          }),
        ],
      });

      const reactionAnswers = await collectSequentialReactions(member, channel, QUESTIONS.REACTIONS);
      if (!reactionAnswers) {
        await channel.send({
          embeds: [
            createEmbed({
              title: '⚠️ Perguntas não respondidas',
              description: 'Você não respondeu às perguntas. Por favor, tente novamente.',
              color: EMBED_COLORS.RED,
            }),
          ],
        });
        return;
      }

      const responseAnswers = await collectSequentialResponses(member, channel, QUESTIONS.RESPONSES);
      if (!responseAnswers) {
        await channel.send({
          embeds: [
            createEmbed({
              title: '⚠️ Perguntas não respondidas',
              description: 'Você não respondeu às perguntas. Por favor, tente novamente.',
              color: EMBED_COLORS.RED,
            }),
          ],
        });
        return;
      }

      const characterName = Object.keys(MAPPINGS.characters).find(
        (name) => MAPPINGS.characters[name].emoji === reactionAnswers.character
      );

      const course = MAPPINGS.courses[reactionAnswers.role];

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
      await channel.send({
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

      setTimeout(async () => {
        try {
          await channel.delete();
          console.log(`Canal ${channel.name} foi deletado com sucesso.`);
        } catch (error) {
          console.error(`Erro ao deletar o canal ${channel.name}:`, error);
        }
      }, 5000);
    } catch (error) {
      CustomError.logger(error, 'guildMemberAdd');
    }
  },
};
