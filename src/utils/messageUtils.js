import { EmbedBuilder } from 'discord.js';

export async function deleteMessage(message, time = 5000) {
  if (!message || typeof message.delete !== 'function') return;

  try {
    if (time > 0) {
      await new Promise(resolve => setTimeout(resolve, time));
    }

    await message.delete();
  } catch (error) {
    console.error(`Falha ao deletar a mensagem: ${error.message}`);
  }
}


export function createEmbed({
  title,
  description,
  color = '#0099ff',
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
  if (footer) embed.setFooter({ text: footer.content || '', iconURL: footer.iconURL || null });
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);

  if (author) {
    let iconURL = '';
    if (author.displayAvatarURL) {
      iconURL = author.displayAvatarURL({ dynamic: true });
    } else if (author.iconURL) {
      iconURL = author.iconURL({ dynamic: true });
    }

    embed.setAuthor({
      name: author.name || author.username || 'Desconhecido',
      iconURL: iconURL || null,
    });
  }

  if (timestamp) embed.setTimestamp(new Date(timestamp));
  return embed;
}
