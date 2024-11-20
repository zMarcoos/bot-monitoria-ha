import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import UserService from '../services/userService.js';

const JAKE_REGIONS = [
  { xMin: 60, yMin: 140, xMax: 182, yMax: 260 },
  { xMin: 60, yMin: 55, xMax: 80, yMax: 140 },
  { xMin: 185, yMin: 140, xMax: 220, yMax: 195 },
  { xMin: 185, yMin: 235, xMax: 220, yMax: 258 },
  { xMin: 40, yMin: 235, xMax: 60, yMax: 253 },
];

const FINN_REGIONS = [
  { xMin: 60, yMin: 140, xMax: 182, yMax: 260 },
  { xMin: 60, yMin: 55, xMax: 80, yMax: 140 },
  { xMin: 185, yMin: 140, xMax: 220, yMax: 195 },
  { xMin: 185, yMin: 235, xMax: 220, yMax: 258 },
  { xMin: 40, yMin: 235, xMax: 60, yMax: 253 },
];

function drawStar(context, x, y, radius, color) {
  const spikes = 5;
  const outerRadius = radius;
  const innerRadius = radius / 2;

  context.beginPath();
  context.moveTo(x, y - outerRadius);

  for (let index = 0; index < spikes; index++) {
    const angleOuter = (index * 2 * Math.PI) / spikes - Math.PI / 2;
    const angleInner = ((index + 0.5) * 2 * Math.PI) / spikes - Math.PI / 2;

    context.lineTo(x + Math.cos(angleOuter) * outerRadius, y + Math.sin(angleOuter) * outerRadius);
    context.lineTo(x + Math.cos(angleInner) * innerRadius, y + Math.sin(angleInner) * innerRadius);
  }

  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawRegionBoxes(context, regions) {
  context.strokeStyle = 'red';
  context.lineWidth = 2;

  regions.forEach(region => {
    context.strokeRect(region.xMin, region.yMin, region.xMax - region.xMin, region.yMax - region.yMin);
  });
}

async function generateImageWithStars(character, starCount = 1) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const background = await loadImage(path.join(__dirname, `../../assets/${character}.png`));

  const canvas = createCanvas(background.width, background.height);
  const context = canvas.getContext('2d');

  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  for (let index = 0; index < starCount; index++) {
    const regions = character === 'Finn' ? FINN_REGIONS : JAKE_REGIONS;

    let randomRegion = regions[Math.floor(Math.random() * regions.length)];

    const usedPositions = new Set();

    let x, y;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      x = Math.floor(Math.random() * (randomRegion.xMax - randomRegion.xMin) + randomRegion.xMin);
      y = Math.floor(Math.random() * (randomRegion.yMax - randomRegion.yMin) + randomRegion.yMin);

      const positionKey = `${x}-${y}`;

      if (!usedPositions.has(positionKey)) {
        usedPositions.add(positionKey);
        break;
      }

      attempts += 1;

      if (attempts >= maxAttempts) {
        randomRegion = regions[Math.floor(Math.random() * regions.length)];
        attempts = 0;
      }

    } while (true);

    const starSize = 10;
    drawStar(context, x, y, starSize, 'yellow');
  }

  return canvas.toBuffer('image/png');
}

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('usuario')
    .setDescription('Comando de usuários')
    .addStringOption(option =>
      option.setName('acao')
        .setDescription('Categoria de ação')
        .setRequired(true)
        .addChoices(
          { name: 'Avatar', value: 'avatar' },
        )),
  async execute(interaction) {
    const acao = interaction.options.getString('acao');

    switch (acao) {
      case 'avatar':
        const userService = new UserService();
        const user = await userService.getUser(interaction.user.id);
        if (!user) {
          await interaction.reply({ content: 'Você não está registrado no sistema.', ephemeral: true });
          return;
        }

        const imageBuffer = await generateImageWithStars(user.character, user.activityHistory.length);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'avatar.png' });
        await interaction.reply({ files: [attachment] });
        break;
      default:
        await interaction.reply('Ação inválida.');
        break;
    }
  },
};
