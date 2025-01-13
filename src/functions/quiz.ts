import { Message, TextChannel } from "discord.js";

export interface Answer {
  question: string;
  response: string;
  message: Message;
}

export async function runQuestionnaire({
  channel,
  memberId,
  questions,
}: {
  channel: TextChannel;
  memberId: string;
  questions: string[];
}): Promise<{ answers: Answer[]; botMessages: Message[] } | null> {
  const answers: Answer[] = [];
  const botMessages: Message[] = [];
  const filter = (message: Message) => message.author.id === memberId;

  for (const question of questions) {
    const botMessage = await channel.send(question);
    botMessages.push(botMessage);

    try {
      const messages = await channel.awaitMessages({
        filter,
        max: 1,
        time: 300_000,
        errors: ["time"],
      });

      const response = messages.first();
      if (response?.content.toLowerCase() === "cancelar") {
        await channel.send("Questionário cancelado.");
        return null;
      }

      answers.push({
        question,
        response: response?.content || "",
        message: response!,
      });
    } catch {
      await channel.send("Tempo para resposta esgotado. Questionário encerrado.");
      return null;
    }
  }

  return { answers, botMessages };
}
