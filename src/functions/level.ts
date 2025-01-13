import { query } from "#database";
import { log } from "#settings";

export const XP_VALUES: Record<string, number> = {
  pratico: 10,
  desafio: 20,
  trabalho: 30,
};

export const ROLES = [
  { name: "Aprendiz de Algoritmos", id: "1309353021490200627" },
  { name: "Feiticeiro dos Dados", id: "1309353547237687337" },
  { name: "Guardião dos Códigos", id: "1309353735578718239" },
  { name: "Arcanista Digital", id: "1309354146494943232" },
  { name: "Feiticeiro Alado", id: "1310339027928616960" },
  { name: "Mago Mestre do Código", id: "1309353865539223563" },
];

let cachedLevelXPBoundaries: number[] | null = null;
let lastCalculatedHash: string | null = null;

function calculateHash(data: any): string {
  return JSON.stringify(data);
}

export async function calculateLevelXPDistribution(): Promise<number[]> {
  try {
    const allActivities = await query(
      `SELECT type, COUNT(*) AS count FROM activities GROUP BY type`
    );
    const currentHash = calculateHash(allActivities);

    if (cachedLevelXPBoundaries && lastCalculatedHash === currentHash) {
      return cachedLevelXPBoundaries;
    }

    lastCalculatedHash = currentHash;

    if (!allActivities.length) {
      console.warn("Nenhuma atividade disponível para calcular XP.");
      return Array.from({ length: ROLES.length }, () => 0);
    }

    const totalXP = allActivities.reduce((total, activity) => {
      const type = activity.type;
      const count = parseInt(activity.count, 10);
      return total + (XP_VALUES[type] || 0) * count;
    }, 0);

    if (totalXP === 0) {
      console.warn("Nenhuma atividade disponível para calcular XP.");
      return Array.from({ length: ROLES.length }, () => 0);
    }

    const xpPerLevel = Math.ceil(totalXP / (ROLES.length - 1));
    const levelBoundaries = Array.from({ length: ROLES.length }, (_, index) => xpPerLevel * index);

    levelBoundaries[ROLES.length - 1] = totalXP;
    cachedLevelXPBoundaries = levelBoundaries;

    return cachedLevelXPBoundaries;
  } catch (error) {
    log.error("Erro ao calcular distribuição de XP por nível:", error);
    return Array.from({ length: ROLES.length }, () => 0);
  }
}

export async function calculateUserExperience(userId: string): Promise<number> {
  try {
    const activities = await query(
      `
      SELECT a.type
      FROM user_activities ua
      JOIN activities a ON ua.activity_id = a.id
      WHERE ua.user_id = $1 AND ua.date_completed IS NOT NULL
      `,
      [userId]
    );

    return activities.reduce((totalXP, activity) => {
      return totalXP + (XP_VALUES[activity.type] || 0);
    }, 0);
  } catch (error) {
    log.error("Erro ao calcular experiência do usuário:", error);
    return 0;
  }
}

export async function determineUserLevel(userXP: number): Promise<number> {
  try {
    const levelXPDistribution = await calculateLevelXPDistribution();

    for (let level = 0; level < levelXPDistribution.length - 1; level++) {
      if (userXP >= levelXPDistribution[level] && userXP < levelXPDistribution[level + 1]) {
        return level;
      }
    }

    if (userXP === levelXPDistribution[levelXPDistribution.length - 1]) {
      return levelXPDistribution.length - 1;
    }

    return 0;
  } catch (error) {
    log.error("Erro ao determinar nível do usuário:", error);
    return 0;
  }
}

export async function calculateLevelProgress(userXP: number): Promise<number> {
  try {
    const levelXPDistribution = await calculateLevelXPDistribution();

    const currentLevel = await determineUserLevel(userXP);
    const previousXP = currentLevel === 0 ? 0 : levelXPDistribution[currentLevel - 1];
    const currentLevelXP = levelXPDistribution[currentLevel] - previousXP;

    return currentLevelXP === 0 ? 100 : ((userXP - previousXP) / currentLevelXP) * 100;
  } catch (error) {
    log.error("Erro ao calcular progresso de nível do usuário:", error);
    return 0;
  }
}
