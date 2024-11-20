import { ReactionCollector, MessageCollector } from 'discord.js';
import { createEmbed, deleteMessage } from './messageUtils.js';

const TIME_LIMIT = 300_000;

async function createCollector({ channel, CollectorClass, filter, time, onCollect, onEnd }) {
  return new Promise((resolve) => {
    const collector = new CollectorClass(channel, { filter, time });

    collector.on('collect', (item) => {
      onCollect(item, resolve, collector);
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'collected') {
        if (onEnd) onEnd();

        resolve(null);
      }
    });
  });
}

export async function collectSequentialReactions(member, channel, questions) {
  const answers = {};

  for (const { key, question, emojis } of questions) {
    const questionMessage = await channel.send({
      embeds: [
        createEmbed({
          title: '❓ Pergunta',
          description: question,
          color: '5555FF',
        }),
      ],
    });

    for (const emoji of emojis) {
      await questionMessage.react(emoji);
    }

    const response = await createCollector({
      channel: questionMessage,
      CollectorClass: ReactionCollector,
      filter: (reaction, user) => emojis.includes(reaction.emoji.name) && user.id === member.id,
      time: TIME_LIMIT,
      onCollect: (reaction, resolve, collector) => {
        resolve(reaction.emoji.name);
        collector.stop('collected');
      },
      onEnd: async () => {
        await channel.send({
          embeds: [
            createEmbed({
              title: 'Erro',
              description: 'Não foi possível coletar suas respostas. Por favor, tente novamente.',
              color: 'ff5555',
            }),
          ],
        }).then(deleteMessage);
      },
    });

    answers[key] = response || 'Sem resposta';
  }

  return answers;
}

export async function collectSequentialResponses(member, channel, questions) {
  const answers = {};

  for (const { key, question, validate } of questions) {
    await channel.send({
      embeds: [
        createEmbed({
          title: '❓ Pergunta',
          description: question,
          color: '5555FF',
        }),
      ],
    });

    const response = await createCollector({
      channel,
      CollectorClass: MessageCollector,
      filter: (message) => message.author.id === member.id,
      time: TIME_LIMIT,
      onCollect: async (message, resolve, collector) => {
        if (validate && !validate(message.content)) {
          await channel.send({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Resposta inválida. Tente novamente.',
                color: 'ff5555',
              }),
            ],
          }).then(deleteMessage);
        } else {
          resolve(message.content.trim());
          collector.stop('collected');
        }
      },
      onEnd: async () => {
        await channel.send({
          embeds: [
            createEmbed({
              title: 'Erro',
              description: 'Não foi possível coletar suas respostas. Por favor, tente novamente.',
              color: 'ff5555',
            }),
          ],
        }).then(deleteMessage);
      },
    });

    answers[key] = response || 'Sem resposta';
  }

  return answers;
}

export async function sendDM(member, channel, message, maxAttempts = 5, interval = 60000) {
  const retryTime = Math.floor((Date.now() + (maxAttempts * interval)) / 1000);
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const dmChannel = await member.createDM();
      await dmChannel.send(message);

      return dmChannel;
    } catch (error) {
      if (attempts === 0) {
        await channel.send({
          content: `${member}`,
          embeds: [
            createEmbed({
              title: 'Erro',
              description: `Não foi possível enviar a mensagem para ${member}. Tentando novamente em <t:${retryTime}:R>. Habilite suas mensagens privadas.`,
              color: 'ff5555',
            }),
          ],
        }).then(message => deleteMessage(message, maxAttempts * interval));
      }

      attempts += 1;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  return null;
}