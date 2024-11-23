import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { EMBED_COLORS } from '../utils/constants.js';

export async function deleteMessage(message, time = 5000) {
  if (!message || typeof message.delete !== 'function') return;

  setTimeout(async () => {
    try {
      await message.delete();
    } catch (error) {
      console.error(`Falha ao deletar a mensagem: ${error.message}`);
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

    if (allMessages.length === 0) {
      console.log('Nenhuma mensagem encontrada.');
      return;
    }

    await Promise.all(
      allMessages.map(async (message) => {
        await Promise.all(
          message.reactions.cache.map(async (reaction) => {
            if (reaction.partial) {
              try {
                await reaction.fetch();
              } catch (error) {
                console.error(`Erro ao buscar reação: ${error.message}`);
              }
            }
          })
        );
      })
    );

    console.log('Processamento de mensagens completo.');
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
  }
}

export function getRandomAdventureImage() {
  const assetsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets');

  const images = fs.readdirSync(assetsPath).filter(file => file === 'adventure_time_photos.json');
  if (!images.length) {
    console.error('Arquivo adventure_time_photos.json não encontrado.');
    return { url: '' };
  }

  const photos = JSON.parse(fs.readFileSync(path.join(assetsPath, images[0]), 'utf-8'));

  return photos[Math.floor(Math.random() * photos.length)];
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
  const embed = new EmbedBuilder();

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color) embed.setColor(color);
  if (fields.length > 0) embed.addFields(fields);

  if (footer && footer.text) {
    embed.setFooter({
      text: footer.text,
      iconURL: footer.iconURL || null,
    });
  }

  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  if (author) {
    embed.setAuthor({
      name: author.name || author.username || 'Desconhecido',
      iconURL: author.iconURL || null,
    });
  }

  if (timestamp) embed.setTimestamp(new Date(timestamp));
  return embed;
}