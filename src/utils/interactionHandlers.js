import { ReactionCollector, MessageCollector, ButtonStyle } from 'discord.js';
import { createEmbed, deleteMessage } from './messageUtils.js';
import CustomError from '../exceptions/customError.js';
import { EXPIRATION_TIME_LIMIT } from './constants.js';

async function createCollector({ channel, CollectorClass, filter, time, onCollect, onEnd }) {
  return new Promise((resolve, reject) => {
    try {
      const collector = new CollectorClass(channel, { filter, time });

      collector.on('collect', (item) => {
        if (!item || (item.message && item.message.deleted)) {
          console.warn('Item coletado está inválido ou mensagem foi deletada.');
          collector.stop('message_deleted');
          return;
        }

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
      if (!channel || !channel.isTextBased()) {
        throw new CustomError(
          'Canal inválido',
          'O canal fornecido não é válido ou não suporta mensagens.',
          { code: 400 }
        );
      }

      const questionMessage = await channel.send({
        embeds: [
          createEmbed({
            title: '❓ Pergunta',
            description: question,
            color: '5555FF',
          }),
        ],
      });

      if (!questionMessage || questionMessage.deleted) {
        throw new CustomError(
          'Erro ao enviar mensagem',
          `Não foi possível enviar a mensagem para a pergunta: "${question}".`,
          { code: 400 }
        );
      }

      await Promise.all(emojis.map((emoji) => questionMessage.react(emoji)));

      const response = await createCollector({
        channel: questionMessage,
        CollectorClass: ReactionCollector,
        filter: (reaction, user) => emojis.includes(reaction.emoji.name) && user.id === member.id,
        time: EXPIRATION_TIME_LIMIT,
        onCollect: (reaction, resolve, collector) => {
          if (!reaction || reaction.message.deleted) {
            console.warn('Reação inválida ou mensagem foi deletada.');
            collector.stop('message_deleted');
            return;
          }

          resolve(reaction.emoji.name);
          collector.stop('collected');
        },
        onEnd: async () => {
          if (!questionMessage || questionMessage.deleted) {
            console.warn('Mensagem não encontrada ou foi deletada.');
            return;
          }

          if (!channel || !channel.isTextBased()) {
            throw new CustomError(
              'Canal inválido',
              'O canal fornecido não é válido ou não suporta mensagens.',
              { code: 400 }
            );
          }

          await deleteMessage(
            await channel.send({
              embeds: [
                createEmbed({
                  title: 'Erro',
                  description: 'Não foi possível coletar suas respostas. Por favor, tente novamente.',
                  color: 'ff5555',
                }),
              ],
            })
          );
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
      if (!channel || !channel.isTextBased()) {
        throw new CustomError(
          'Canal inválido',
          'O canal fornecido não é válido ou não suporta mensagens.',
          { code: 400 }
        );
      }

      const questionMessage = await channel.send({
        embeds: [
          createEmbed({
            title: '❓ Pergunta',
            description: question,
            color: '5555FF',
          }),
        ],
      });

      if (!questionMessage) {
        throw new CustomError(
          'Erro ao enviar mensagem',
          `Não foi possível enviar a mensagem para a pergunta: "${question}".`,
          { code: 400 }
        );
      }

      if (deletable) {
        messagesToDelete.push(questionMessage);
      }

      const response = await createCollector({
        channel,
        CollectorClass: MessageCollector,
        filter: (message) => message.author.id === member.id,
        time: EXPIRATION_TIME_LIMIT,
        onCollect: async (message, resolve, collector) => {
          if (!message || message.deleted) {
            console.warn('Mensagem coletada foi deletada.');
            collector.stop('message_deleted');
            return;
          }

          if (validate && !validate(message.content)) {
            if (!channel || !channel.isTextBased()) {
              throw new CustomError(
                'Canal inválido',
                'O canal fornecido não é válido ou não suporta mensagens.',
                { code: 400 }
              );
            }

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
          if (!questionMessage || questionMessage.deleted) {
            console.warn('Mensagem foi deletada antes de encerrar o coletor.');
            return;
          }

          if (!channel || !channel.isTextBased()) {
            throw new CustomError(
              'Canal inválido',
              'O canal fornecido não é válido ou não suporta mensagens.',
              { code: 400 }
            );
          }

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

      await Promise.all(
        messagesToDelete
          .filter((message) => message.deletable)
          .map((message) => deleteMessage(message, 0))
      );

    } catch (error) {
      throw new CustomError(
        'Erro ao coletar respostas',
        `Falha ao coletar a resposta para a pergunta: "${question}".`,
        { code: 400 }
      );
    }
  }

  return answers;
}

export async function createPaginationCollector({
  interaction,
  initialEmbed,
  totalItems,
  itemsPerPage,
  generateEmbed,
  time = EXPIRATION_TIME_LIMIT,
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
    if (!message || !message.editable) {
      throw new CustomError(
        'Erro na paginação',
        'Não foi possível enviar a mensagem inicial da paginação.',
        { code: 500 }
      );
    }

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

      //alterar o negócio de se a mensagem nn for fetch, então não dá pra editar
      if (!message || !message.editable) {
        console.warn('Mensagem não encontrada ou não pode ser editada.');
        return;
      }

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
        console.error('Erro ao editar mensagem:', error);
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
      if (attempts === 0) {
        try {
          if (!channel || !channel.isTextBased()) {
            throw new CustomError(
              'Canal inválido',
              'O canal fornecido não é válido ou não suporta mensagens.',
              { code: 400 }
            );
          }

          await deleteMessage(
            await channel.send({
              content: `${member}`,
              embeds: [
                createEmbed({
                  title: 'Erro ao enviar mensagem privada',
                  description: `Não foi possível enviar a mensagem para ${member}. Tentando novamente em <t:${retryTime}:R>. Certifique-se de que suas mensagens privadas estão habilitadas.`,
                  color: 'ff5555',
                }),
              ],
            }),
            maxAttempts * interval
          )
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