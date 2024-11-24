import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { EMBED_COLORS } from '../utils/constants.js';
import CustomError from '../exceptions/customError.js';

export async function isMessageDeleted(message) {
  try {
    await message.channel.messages.fetch(message.id);
    return false;
  } catch (error) {
    CustomError.logger(error, 'isMessageDeleted');
    return true;
  }
}

export async function deleteMessage(message, time = 5000) {
  if (!message || typeof message.delete !== 'function') return;

  setTimeout(async () => {
    try {
      await message.delete();
    } catch (error) {
      throw new CustomError(
        'Erro ao deletar mensagem',
        `Falha ao deletar a mensagem: ${error.message}`,
        { code: 500 }
      );
    }
  }, time);
}

export async function loadMessages(channel) {
  try {
    const allMessages = [];
    let lastMessageId = null;

    while (true) {
      const fetchedMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });

      if (fetchedMessages.size === 0) break;

      allMessages.push(...fetchedMessages.values());
      lastMessageId = fetchedMessages.last().id;
    }

    if (allMessages.length === 0) return;

    await Promise.all(
      allMessages.map(async (message) => {
        await Promise.all(
          message.reactions.cache.map(async (reaction) => {
            if (reaction.partial) {
              try {
                await reaction.fetch();
              } catch (error) {
                throw new CustomError(
                  'Erro ao buscar reação',
                  `Não foi possível buscar uma reação parcial: ${error.message}`,
                  { code: 500 }
                );
              }
            }
          })
        );
      })
    );
  } catch (error) {
    throw new CustomError(
      'Erro ao carregar mensagens',
      `Ocorreu um erro ao buscar mensagens: ${error.message}`,
      { code: 500 }
    );
  }
}

export function getRandomAdventureImage() {
  const assetsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets');

  try {
    const images = fs
      .readdirSync(assetsPath)
      .filter((file) => file === 'adventure_time_photos.json');

    if (!images.length) {
      throw new CustomError(
        'Arquivo não encontrado',
        'O arquivo adventure_time_photos.json não foi encontrado nos assets.',
        { code: 404 }
      );
    }

    const photos = JSON.parse(fs.readFileSync(path.join(assetsPath, images[0]), 'utf-8'));

    return photos[Math.floor(Math.random() * photos.length)];
  } catch (error) {
    throw new CustomError(
      'Erro ao carregar imagem',
      `Não foi possível obter uma imagem de Adventure Time: ${error.message}`,
      { code: 500 }
    );
  }
}

export function createEmbed({
  title,
  description,
  color = EMBED_COLORS.DEFAULT,
  fields = [],
  footer,
  thumbnail,
  image,
  author,
  timestamp = new Date(),
} = {}) {
  try {
    const embed = new EmbedBuilder();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (color) embed.setColor(color);
    if (fields.length > 0) embed.addFields(fields);

    if (footer && footer.text) {
      embed.setFooter({
        text: footer.text,
        iconURL: footer.iconURL,
      });
    }

    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);

    if (author) {
      embed.setAuthor(resolveAuthor(author));
    }

    if (timestamp) embed.setTimestamp(new Date(timestamp));
    return embed;
  } catch (error) {
    throw new CustomError(
      'Erro ao criar embed',
      `Ocorreu um erro ao criar o embed: ${error.message}`,
      { code: 500 }
    );
  }
}

function resolveAuthor(author) {
  if (!author) return null;

  try {
    const name = author.name || author.username || 'Desconhecido';
    const iconURL =
      typeof author.iconURL === 'function'
        ? author.iconURL({ dynamic: true })
        : typeof author.displayAvatarURL === 'function'
        ? author.displayAvatarURL({ dynamic: true })
        : null;

    return { name, iconURL };
  } catch (error) {
    throw new CustomError(
      'Erro ao resolver autor',
      `Ocorreu um erro ao processar o autor do embed: ${error.message}`,
      { code: 500 }
    );
  }
}
