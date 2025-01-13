import {
  Guild,
  GuildMember,
  TextChannel,
  PermissionsBitField,
} from "discord.js";
import {
  createUser,
  getUserById,
} from "#database/repositories/userRepository.js";
import { Event } from "#base";
import { createEmbed } from "@magicyan/discord";
import { UserData } from "#database/interfaces/UserData.js";
import { runQuestionnaire } from "#functions/quiz.js";
import { runReactionQuestionnaire, ReactionAnswer } from "#functions/reaction.js";

const INITIAL_LEVEL_ROLE_ID = "1309353021490200627";

interface CharacterMapping {
  emoji: string;
}

interface CourseMapping {
  name: string;
  roleId: string;
}

const MAPPINGS = {
  characters: {
    Finn: { emoji: "👨" },
    Jake: { emoji: "🐶" },
  } as Record<string, CharacterMapping>,
  courses: {
    "💻": { name: "Ciência da Computação", roleId: "1298472443362414694" },
    "👥": { name: "Engenharia de Software", roleId: "1298472445560360960" },
  } as Record<string, CourseMapping>,
};

const QUESTIONS = {
  REACTIONS: [
    {
      question: "Escolha o personagem que vai lhe representar:\n👨 - Finn\n🐶 - Jake\n",
      emojis: Object.values(MAPPINGS.characters).map((char) => char.emoji),
    },
    {
      question: "De qual curso você é:\n💻 - Ciência da Computação\n👥 - Engenharia de Software\n",
      emojis: Object.keys(MAPPINGS.courses),
    },
  ],
  RESPONSES: ["Qual é o seu número de matrícula?"],
};

async function createPrivateChannel(guild: Guild, member: GuildMember): Promise<TextChannel | null> {
  try {
    const channel = await guild.channels.create({
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
    return channel as TextChannel;
  } catch (error) {
    console.error("Erro ao criar canal privado:", error);
    return null;
  }
}

async function assignRoleAndNickname(
  member: GuildMember,
  courseName: string,
  characterName: string
): Promise<void> {
  const courseEmoji = Object.keys(MAPPINGS.courses).find(
    (key) => MAPPINGS.courses[key].name === courseName
  );
  const characterEmoji = MAPPINGS.characters[characterName]?.emoji;

  if (!courseEmoji || !characterEmoji) {
    console.error(`Detalhes inválidos: curso ${courseName}, personagem ${characterName}`);
    return;
  }

  const course = MAPPINGS.courses[courseEmoji];
  const role = member.guild.roles.cache.get(course.roleId);
  const initialRole = member.guild.roles.cache.get(INITIAL_LEVEL_ROLE_ID);

  if (!role || !initialRole) {
    console.error(`Cargo não encontrado para o usuário ${member.user.tag}.`);
    return;
  }

  await member.roles.add([role, initialRole]);
  await member.setNickname(`${characterEmoji} ${member.user.username}`);
}

new Event({
  name: "Guild Member Add",
  event: "guildMemberAdd",
  async run(member: GuildMember) {
    if (!member || member.user.bot) return;

    const guild = member.guild;

    try {
      const user = await getUserById(member.id);
      if (user) {
        await assignRoleAndNickname(member, user.course, user.character);
        return;
      }

      const channel = await createPrivateChannel(guild, member);
      if (!channel) {
        console.error("Canal privado não encontrado!");
        return;
      }

      await channel.send({
        embeds: [
          createEmbed({
            title: `👋 Boas-vindas ao servidor ${guild.name}!`,
            description: `Olá, ${member}! Para começar, responda às seguintes perguntas para criarmos o seu perfil.`,
            color: "Blue",
            author: {
              name: guild.name,
              iconURL: guild.iconURL() ?? undefined,
            },
          }),
        ],
      });

      const reactionAnswers: ReactionAnswer[] | null = await runReactionQuestionnaire({
        channel,
        memberId: member.id,
        questions: QUESTIONS.REACTIONS,
      });

      if (!reactionAnswers) {
        await channel.send("Questionário encerrado. Para refazer, entre no servidor novamente.");
        return;
      }

      const responseResult = await runQuestionnaire({
        channel,
        memberId: member.id,
        questions: QUESTIONS.RESPONSES,
      });

      if (!responseResult) {
        await channel.send("Questionário encerrado. Para refazer, entre no servidor novamente.");
        return;
      }

      const { answers } = responseResult;

      const characterAnswer = reactionAnswers[0];
      const courseAnswer = reactionAnswers[1];
      const characterName = Object.keys(MAPPINGS.characters).find(
        (key) => MAPPINGS.characters[key].emoji === characterAnswer?.reaction
      );
      const course = MAPPINGS.courses[courseAnswer.reaction];

      if (!characterName || !course) {
        console.error("Detalhes inválidos ao criar perfil.");
        return;
      }

      const userData: UserData = {
        id: member.id,
        enrollment: answers[0].response,
        course: course.name,
        character: characterName,
        xp: 0,
        level: 0,
        role: "Aprendiz de Algoritmos",
        streak: 0,
        maxStreak: 0,
        lastActivity: null,
      };

      await createUser(userData);
      await assignRoleAndNickname(member, course.name, characterName);

      await channel.send({
        content: `${member}`,
        embeds: [
          createEmbed({
            title: "🎉 Perfil criado com sucesso",
            description: `👤 **Nome**: ${member.user.username}\n🏷️ **Personagem**: ${characterName}\n📓 **Curso**: ${course.name}`,
            author: {
              name: member.user.username,
              iconURL: member.user.displayAvatarURL({ forceStatic: false }),
            },
            footer: {
              text: "Seu perfil foi criado com sucesso. Tenha um excelente aprendizado na disciplina.",
              iconURL: guild.iconURL({ forceStatic: false }) ?? undefined,
            },
            color: "Green",
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
      console.error("Erro ao executar evento GuildMemberAdd:", error);
    }
  },
});
