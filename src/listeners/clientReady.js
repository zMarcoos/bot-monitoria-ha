import { Events } from 'discord.js';
import { loadMessages } from '../utils/messageUtils.js';
import CustomError from '../exceptions/customError.js';

export default {
  once: true,
  event: Events.ClientReady,
  async execute(client) {
    console.log(`Estou pronto como ${client.user.tag}!`);

    const activityChannel = client.channels.cache.get('1309657893460512902');
    if (!activityChannel) {
      console.log('Canal de submissões não encontrado!');
      return;
    }

    try {
      await loadMessages(activityChannel);
      console.log('Mensagens carregadas com sucesso!');
    } catch (error) {
      CustomError.logger(error, 'clientReady');
    }
  },
};
