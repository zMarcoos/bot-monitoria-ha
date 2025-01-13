import { log } from "#settings";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonFilePath = path.join(__dirname, "../../assets/adventure_time_photos.json");

export const getRandomAdventureTimePhoto = () => {
  try {
    const jsonData = fs.readFileSync(jsonFilePath, "utf8");
    const photos = JSON.parse(jsonData);

    if (!Array.isArray(photos) || photos.length === 0) {
      return undefined;
    }

    const randomIndex = Math.floor(Math.random() * photos.length);
    return photos[randomIndex];
  } catch (error) {
    log.error("Erro ao ler arquivo de fotos:", error);
  }
};
