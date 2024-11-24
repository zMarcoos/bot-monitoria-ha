import { Events } from 'discord.js';
import CustomError from '../exceptions/customError.js';

export default {
  once: true,
  event: Events.Error,
  async execute(error) {
    CustomError.logger(error, 'Evento de erro');
  },
};
