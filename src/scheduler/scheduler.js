import cron from 'node-cron';
import UserService from '../database/services/userService.js';
import { getMember } from '../utils/userUtils.js';

const webhookSummaryURL = 'https://discord.com/api/webhooks/1304962956504596581/scecJvnPoOVm8Z3vYspP12F0uM5T4HxyYvJTH8PoXhvQjDvA8uGAZEKtatNNWXcjHDEP';

const webhookGoodMessagesURL = 'https://discord.com/api/webhooks/1305049907605803050/2B3E6VJ0OBjTSZYLYYWVnT5x31Zb8jZDhtvLX7P9Ou2Tt073moe1jCZF4lAOuPqVkxSH';

async function sendWebhookMessage(content, webhookURL) {
  try {
    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (response.ok) {
      console.log('Mensagem enviada com sucesso!');
    } else {
      console.error('Erro ao enviar mensagem:', response.statusText);
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
  }
}

async function getGoodMessage() {
  const url = 'https://quotes15.p.rapidapi.com/quotes/random/?language_code=pt';
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': '5470106a76msh31fb73d33b97afcp12895bjsndd4049daf87b',
      'X-RapidAPI-Host': 'quotes15.p.rapidapi.com'
    }
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar frase motivacional:', error);
  }
}

export const initScheduler = () => {
  cron.schedule('0 6 * * 1', async () => {
    const userService = new UserService();
    const listUsers = await userService.listUsers();

    const summary = listUsers.length ? listUsers.map(user => `🧑 Nome: **${getMember(user.id) || 'Desconhecido'}** | 🌟 XP: **${user.xp}** | 🏆 Nível: **${user.level}**`).join('\n') : '⚠️ Nenhum usuário encontrado.';

    sendWebhookMessage(`**Relatório do desempenho semanal dos alunos**\n${summary}`, webhookSummaryURL);
  });

  cron.schedule('0 6 * * *', async () => {
    const goodMessage = await getGoodMessage();
    if (!goodMessage) return;

    sendWebhookMessage(`🌸 Frase do dia: ${goodMessage.content}\nAutor: [${goodMessage.originator.name}](${goodMessage.url})`, webhookGoodMessagesURL);
  });
};