import client from '../index.js';
import CustomError from '../exceptions/customError.js';

export async function getMember(userId) {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new CustomError(
        'Guilda não encontrada',
        'Não foi possível obter a primeira guilda do cliente.',
        { code: 404 }
      );
    }

    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch(userId);
    }

    return member;
  } catch (error) {
    throw new CustomError(
      'Erro ao buscar membro',
      `Não foi possível buscar o membro com ID ${userId}. Detalhes do erro: ${error.message}`,
      { code: 500 }
    );
  }
}
