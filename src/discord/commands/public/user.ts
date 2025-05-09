import { Command } from "#base";
import { getUserById } from "#database/repositories/userRepository.js";
import { userActivityRepository } from "#database/repositories/userActivityRepository.js";
import { ApplicationCommandType, AttachmentBuilder } from "discord.js";
import { createCanvas, loadImage } from "canvas";
import { fileURLToPath } from "url";
import { ROLES } from "#functions/level.js";
import path from "path";

const JAKE_REGIONS = [
  { xMin: 110, yMin: 140, xMax: 182, yMax: 260 },
  { xMin: 60, yMin: 140, xMax: 110, yMax: 260 },
  { xMin: 60, yMin: 55, xMax: 80, yMax: 140 },
  { xMin: 185, yMin: 140, xMax: 220, yMax: 195 },
  { xMin: 185, yMin: 235, xMax: 220, yMax: 258 },
  { xMin: 40, yMin: 235, xMax: 60, yMax: 253 },
];

const FINN_REGIONS = [
  { xMin: 95, yMin: 190, xMax: 270, yMax: 270 },
  { xMin: 50, yMin: 160, xMax: 93, yMax: 240 },
  { xMin: 300, yMin: 220, xMax: 335, yMax: 320 },
  { xMin: 210, yMin: 140, xMax: 270, yMax: 190 },
];

function drawStar(context: any, x: any, y: any, radius: any) {
  const spikes = 5;
  const outerRadius = radius;
  const innerRadius = radius / 2;

  context.save();
  context.beginPath();
  context.moveTo(x, y - outerRadius);

  for (let index = 0; index < spikes; index++) {
    const angleOuter = (index * 2 * Math.PI) / spikes - Math.PI / 2;
    const angleInner = ((index + 0.5) * 2 * Math.PI) / spikes - Math.PI / 2;

    context.lineTo(
      x + Math.cos(angleOuter) * outerRadius,
      y + Math.sin(angleOuter) * outerRadius,
    );
    context.lineTo(
      x + Math.cos(angleInner) * innerRadius,
      y + Math.sin(angleInner) * innerRadius,
    );
  }

  context.closePath();
  context.fillStyle = "#FFFF00";
  context.fill();
  context.restore();
}

async function generateImageWithStars(character: string, starCount = 1, final = false) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const background = await loadImage(
    path.join(__dirname, `../../../../assets/${character}.png`)
  );

  const canvas = createCanvas(background.width, background.height);
  const context = canvas.getContext("2d");

  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  const regions = character === "Finn" ? FINN_REGIONS : JAKE_REGIONS;

  if (final) {
    const firstRegion = regions[0];
    const centerX = (firstRegion.xMin + firstRegion.xMax) / 2;
    const centerY = (firstRegion.yMin + firstRegion.yMax) / 2;

    drawStar(context, centerX, centerY, 30);
  } else {
    const usedPositions = new Set();

    for (let index = 0; index < starCount; index++) {
      let randomRegion = regions[Math.floor(Math.random() * regions.length)];
      let x, y;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        x = Math.floor(
          Math.random() * (randomRegion.xMax - randomRegion.xMin) +
            randomRegion.xMin
        );
        y = Math.floor(
          Math.random() * (randomRegion.yMax - randomRegion.yMin) +
            randomRegion.yMin
        );

        const positionKey = `${x}-${y}`;
        if (!usedPositions.has(positionKey)) {
          usedPositions.add(positionKey);
          break;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          randomRegion = regions[Math.floor(Math.random() * regions.length)];
          attempts = 0;
        }
      } while (true);

      drawStar(context, x, y, 10);
    }
  }

  return canvas.toBuffer("image/png");
}

new Command({
  name: "usuario",
  description: "Comando de usuário",
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = await getUserById(interaction.user.id);
    if (!user) {
      await interaction.editReply({
        content: "Você não possui um usuário cadastrado no sistema.",
      });
      return;
    }

    const allActivities = await userActivityRepository.getAllActivitiesByUserId(user.id);
    const doneActivities = allActivities.filter((activity) => activity.dateCompleted !== null);

    const imageBuffer = await generateImageWithStars(
      user.character,
      doneActivities.length,
      user.level === ROLES.length - 1,
    );

    const attachment = new AttachmentBuilder(imageBuffer, { name: "avatar.png" });
    await interaction.editReply({ files: [attachment] });
  }
});