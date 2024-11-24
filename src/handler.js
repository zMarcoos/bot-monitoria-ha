import { REST, Routes } from 'discord.js';
import fs from 'fs';
import CustomError from './exceptions/customError.js';

export async function loadCommands(client) {
  const commandsPath = new URL('./commands', import.meta.url);
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

  const loadPromises = commandFiles.map(async (file) => {
    const filePath = new URL(`./commands/${file}`, import.meta.url);

    try {
      const command = await import(filePath);
      const commandData = command.default || command;

      if (commandData.data && commandData.execute) {
        client.commands.set(commandData.data.name, commandData);
        console.info(`Comando carregado: ${file}`);
      } else {
        throw new CustomError(
          'Erro ao carregar comando',
          `Comando ${file} não possui 'data' e 'execute'.`,
          { code: 400 }
        );
      }
    } catch (error) {
      throw new CustomError(
        'Erro ao carregar comando',
        `Erro ao carregar o comando ${file}: ${error.message}`,
        { code: 500 }
      );
    }
  });

  await Promise.all(loadPromises);
}

export async function loadListeners(client) {
  const listenersPath = new URL('./listeners', import.meta.url);
  const listenerFiles = fs.readdirSync(listenersPath).filter((file) => file.endsWith('.js'));

  const loadPromises = listenerFiles.map(async (file) => {
    const filePath = new URL(`./listeners/${file}`, import.meta.url);

    try {
      const listener = await import(filePath);
      const listenerData = listener.default || listener;

      if (typeof listenerData.execute !== 'function' || !listenerData.event) {
        throw new CustomError(
          'Erro ao carregar listener',
          `Evento ${file} não possui 'event' ou 'execute'.`,
          { code: 400 }
        );
      }

      if (listenerData.once) {
        client.once(listenerData.event, (...args) => listenerData.execute(...args));
      } else {
        client.on(listenerData.event, (...args) => listenerData.execute(...args));
      }

      console.info(`Ouvindo evento: ${file}`);
    } catch (error) {
      throw new CustomError(
        'Erro ao carregar listener',
        `Erro ao carregar o evento ${file}: ${error.message}`,
        { code: 500 }
      );
    }
  });

  await Promise.all(loadPromises);
}

export async function loadSlashCommands(client) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.info('Registrando os comandos de slash...');

    const commands = [...client.commands.values()].map((command) => command.data.toJSON());
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.info('Comandos de slash registrados com sucesso!');
  } catch (error) {
    throw new CustomError(
      'Erro ao registrar comandos de slash',
      `Erro ao registrar os comandos de slash: ${error.message}`,
      { code: 500 }
    );
  }
}
