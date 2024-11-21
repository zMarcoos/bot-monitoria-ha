import ActivityService from '../database/services/activityService.js';

export const XP_VALUES = {
  pratico: 10,
  desafio: 20,
  trabalho: 30
};

export const ROLES = [
  'Aprendiz de Algoritmos',
  'Iniciado dos Encantamentos Lógicos',
  'Feiticeiro dos Dados',
  'Guardião dos Códigos',
  'Arcanista Digital',
  'Mago Mestre do Código'
];

async function calculateMaxXP() {
  const activityService = new ActivityService();
  const allActivities = await activityService.listActivities();

  const activityCounts = allActivities.reduce((acc, activity) => {
    acc[activity.type] = (acc[activity.type] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(activityCounts).reduce((totalXP, [type, count]) => {
    return totalXP + (XP_VALUES[type] * count || 0);
  }, 0);
}

export async function calculateUserExperience(activities) {
  return activities.reduce((accumulator, activity) => {
    return accumulator + (XP_VALUES[activity.type] || 0);
  }, 0);
}

export async function calculateDynamicLevel(experience, currentLevel = 1) {
  const maxXP = await calculateMaxXP();
  const maxLevel = ROLES.length;

  const xpPerLevel = maxXP / maxLevel;
  let newLevel = maxLevel;

  for (let level = 1; level <= maxLevel; level++) {
    if (experience < xpPerLevel * level) {
      newLevel = level;
      break;
    }
  }

  const levelUp = newLevel > currentLevel;

  return { level: newLevel, role: ROLES[newLevel - 1], levelUp };
}

