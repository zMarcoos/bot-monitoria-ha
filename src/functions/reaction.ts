import { TextChannel, MessageReaction, User } from "discord.js";

export interface ReactionAnswer {
  question: string;
  reaction: string;
}

export async function runReactionQuestionnaire({
  channel,
  memberId,
  questions,
}: {
  channel: TextChannel;
  memberId: string;
  questions: { question: string; emojis: string[] }[];
}): Promise<ReactionAnswer[] | null> {
  const answers: ReactionAnswer[] = [];

  for (let index = 0; index < questions.length; index++) {
    const currentQuestion = questions[index];

    const questionMessage = await channel.send(currentQuestion.question);
    for (const emoji of currentQuestion.emojis) {
      await questionMessage.react(emoji);
    }

    try {
      const filter = (reaction: MessageReaction, user: User) =>
        user.id === memberId &&
        reaction.emoji.name !== null &&
        currentQuestion.emojis.includes(reaction.emoji.name);

      const collected = await questionMessage.awaitReactions({
        filter,
        max: 1,
        time: 300_000,
        errors: ["time"],
      });

      const reaction = collected.first();
      if (!reaction || reaction.emoji.name === null) {
        await channel.send("Tempo para resposta esgotado ou reação inválida. Questionário encerrado.");
        return null;
      }

      answers.push({
        question: currentQuestion.question,
        reaction: reaction.emoji.name,
      });
    } catch {
      await channel.send("Tempo para resposta esgotado. Questionário encerrado.");
      return null;
    }
  }

  return answers;
}
