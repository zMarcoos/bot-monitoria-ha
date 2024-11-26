import { createEmbed } from '../utils/messageUtils.js';
import { EMBED_COLORS } from '../utils/constants.js';

export default class CustomError extends Error {
  constructor(title, message, options = {}) {
    super(message);
    this.title = title;
    this.name = options.name || 'CustomError';
    this.code = options.code;
  }

  static getFormattedMessage(error) {
    const description = error instanceof CustomError
    ? `**Título:** ${error.title}\n**Descrição:** ${error.message}\n**Código:** ${error.code || 'Não especificado'}`
    : `Erro desconhecido: ${error.message}`

    return createEmbed({
      title: '⚠️ Comportamento inesperado',
      description,
      color: EMBED_COLORS.RED,
      timestamp: new Date(),
    });
  }

  static logger(error, taskName = null) {
    let taskDisplayName = taskName;

    if (!taskName) {
      const stack = new Error().stack.split('\n');
      const callerLine = stack[2];
      const callerName = callerLine.match(/at (\S+)/)?.[1] || 'Função desconhecida';
      taskDisplayName = `tarefa na função ${callerName}`
    }

    if (error instanceof CustomError) {
      console.error(`Erro personalizado detectado durante ${taskDisplayName}:`);
      console.error(`Título: ${error.title}`);
      console.error(`Descrição: ${error.message}`);
      if (error.code) console.error(`Código do erro: ${error.code}`);
    } else {
      console.error(`Erro desconhecido durante ${taskDisplayName}: ${error.message}`);
    }
  }
}
