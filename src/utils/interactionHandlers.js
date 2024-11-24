import { ReactionCollector, MessageCollector, ButtonStyle } from 'discord.js';
import { createEmbed, deleteMessage } from './messageUtils.js';
import CustomError from '../exceptions/customError.js';

const TIME_LIMIT = 300_000;

async function createCollector({ channel, CollectorClass, filter, time, onCollect, onEnd }) {
  return new Promise((resolve, reject) => {
    try {
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
    } catch (error) {
      reject(
        new CustomError(
          'Erro no coletor',
          'Ocorreu um erro ao criar o coletor de mensagens ou reações.',
          { code: 500 }
        )
      );
    }
  });
}

export async function collectSequentialReactions(member, channel, questions) {
  const answers = {};

  for (const { key, question, emojis } of questions) {
    try {
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
    } catch (error) {
      throw new CustomError(
        'Erro ao coletar reações',
        `Falha ao coletar reações para a pergunta: "${question}".`,
        { code: 400 }
      );
    }
  }

  return answers;
}

export async function collectSequentialResponses(member, channel, questions) {
  const answers = {};
  const messagesToDelete = [];

  for (const { key, question, validate, deletable = false } of questions) {
    try {
      const questionMessage = await channel.send({
        embeds: [
          createEmbed({
            title: '❓ Pergunta',
            description: question,
            color: '5555FF',
          }),
        ],
      });

      if (deletable) {
        messagesToDelete.push(questionMessage);
      }

      const response = await createCollector({
        channel,
        CollectorClass: MessageCollector,
        filter: (message) => message.author.id === member.id,
        time: TIME_LIMIT,
        onCollect: async (message, resolve, collector) => {
          if (validate && !validate(message.content)) {
            const errorMessage = await channel.send({
              embeds: [
                createEmbed({
                  title: 'Erro',
                  description: 'Resposta inválida. Tente novamente.',
                  color: 'ff5555',
                }),
              ],
            });

            if (deletable) {
              messagesToDelete.push(errorMessage);
            }
          } else {
            resolve(message.content.trim());

            if (deletable) {
              messagesToDelete.push(message);
            }

            collector.stop('collected');
          }
        },
        onEnd: async () => {
          const timeoutMessage = await channel.send({
            embeds: [
              createEmbed({
                title: 'Erro',
                description: 'Não foi possível coletar suas respostas. Por favor, tente novamente.',
                color: 'ff5555',
              }),
            ],
          });

          if (deletable) {
            messagesToDelete.push(timeoutMessage);
          }
        },
      });

      answers[key] = response || 'Sem resposta';
    } catch (error) {
      throw new CustomError(
        'Erro ao coletar respostas',
        `Falha ao coletar a resposta para a pergunta: "${question}".`,
        { code: 400 }
      );
    }
  }

  for (const message of messagesToDelete) {
    deleteMessage(message, 0);
  }

  return answers;
}

export async function createPaginationCollector({
  interaction,
  initialEmbed,
  totalItems,
  itemsPerPage,
  generateEmbed,
  time = TIME_LIMIT,
}) {
  let currentPage = 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  try {
    const createButtons = (page) => {
      const previousDisabled = page === 0;
      const nextDisabled = page === totalPages - 1;

      return [
        {
          customId: 'previous',
          label: '⬅️ Anterior',
          style: ButtonStyle.Primary,
          disabled: previousDisabled,
        },
        {
          customId: 'next',
          label: '➡️ Próximo',
          style: ButtonStyle.Primary,
          disabled: nextDisabled,
        },
      ];
    };

    const sendInitialMessage = async () => {
      const buttons = createButtons(currentPage);
      const components = [
        {
          type: 1,
          components: buttons.map((button) => ({
            type: 2,
            ...button,
          })),
        },
      ];

      return interaction.editReply({
        embeds: [initialEmbed],
        components,
      });
    };

    const message = await sendInitialMessage();

    const collector = message.createMessageComponentCollector({
      filter: (interaction) =>
        ['previous', 'next'].includes(interaction.customId) && interaction.user.id === interaction.user.id,
      time,
    });

    collector.on('collect', async (buttonInteraction) => {
      currentPage += buttonInteraction.customId === 'previous' ? -1 : 1;

      const updatedEmbed = await generateEmbed(currentPage);
      const updatedButtons = createButtons(currentPage);

      await buttonInteraction.update({
        embeds: [updatedEmbed],
        components: [
          {
            type: 1,
            components: updatedButtons.map((button) => ({
              type: 2,
              ...button,
            })),
          },
        ],
      });
    });

    collector.on('end', async () => {
      const disabledButtons = createButtons(currentPage).map((button) => ({
        ...button,
        disabled: true,
      }));

      try {
        await message.edit({
          components: [
            {
              type: 1,
              components: disabledButtons.map((button) => ({
                type: 2,
                ...button,
              })),
            },
          ],
        });
      } catch (error) {
        throw new CustomError(
          'Erro ao desabilitar botões',
          `Falha ao desativar os botões de navegação.`,
          { code: 500 }
        );
      }
    });
  } catch (error) {
    throw new CustomError(
      'Erro na paginação',
      `Não foi possível iniciar ou processar a paginação: ${error.message}`,
      { code: 500 }
    );
  }
}

export async function sendDM(member, channel, message, maxAttempts = 5, interval = 60000) {
  const retryTime = Math.floor((Date.now() + maxAttempts * interval) / 1000);
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const dmChannel = await member.createDM();
      await dmChannel.send(message);
      return dmChannel;
    } catch (error) {
      CustomError.logger(error, 'sendDM');

      if (attempts === 0) {
        try {
          await channel.send({
            content: `${member}`,
            embeds: [
              createEmbed({
                title: 'Erro ao enviar mensagem privada',
                description: `Não foi possível enviar a mensagem para ${member}. Tentando novamente em <t:${retryTime}:R>. Certifique-se de que suas mensagens privadas estão habilitadas.`,
                color: 'ff5555',
              }),
            ],
          }).then((msg) => deleteMessage(msg, maxAttempts * interval));
        } catch (sendError) {
          CustomError.logger(sendError, 'sendDM');

          throw new CustomError(
            'Erro ao enviar feedback',
            'Não foi possível enviar o feedback público sobre a falha no envio da mensagem privada.',
            { code: 500 }
          );
        }
      }

      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new CustomError(
    'Falha no envio de mensagem privada',
    `Não foi possível enviar a mensagem privada para ${member} após ${maxAttempts} tentativas.`,
    { code: 500 }
  );
}