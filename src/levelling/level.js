import ActivityService from '../database/services/activityService.js';
import UserService from '../database/services/userService.js';

export const XP_VALUES = {
  pratico: 10,
  desafio: 20,
  trabalho: 30
};

export const ROLES = [
  { name: 'Aprendiz de Algoritmos', id: '1309353021490200627' },
  { name: 'Feiticeiro dos Dados', id: '1309353547237687337' },
  { name: 'Guardião dos Códigos', id: '1309353735578718239' },
  { name: 'Arcanista Digital', id: '1309354146494943232' },
  { name: 'Mago Mestre do Código', id: '1309353865539223563' }
];

let levelXPDistributionCached = null;

export async function calculateLevelXPDistribution(recalculate = false) {
  if (!recalculate && levelXPDistributionCached) return levelXPDistributionCached;

  const activityService = new ActivityService();
  const allActivities = await activityService.listActivities();

  const activityCounts = allActivities.reduce((accumulator, activity) => {
    accumulator[activity.type] = (accumulator[activity.type] || 0) + 1;
    return accumulator;
  }, {});

  const totalXP = Object.entries(activityCounts).reduce((totalXP, [type, count]) => {
    return totalXP + (XP_VALUES[type] * count || 0);
  }, 0);

  const levels = ROLES.length;
  const levelXP = Math.ceil(totalXP / levels);

  levelXPDistributionCached = Array.from({ length: levels }, (_, index) => (index + 1) * levelXP);

  return levelXPDistributionCached;
}

export async function calculateUserExperience(userActivities) {
  return userActivities.reduce((totalXP, activity) => {
    return totalXP + (XP_VALUES[activity.type] || 0);
  }, 0);
}

export async function determineUserLevel(userXP) {
  const levelXPDistribution = await calculateLevelXPDistribution();

  for (let level = 0; level < levelXPDistribution.length; level++) {
    if (userXP < levelXPDistribution[level]) {
      return level;
    }
  }
  return levelXPDistribution.length;
}

export async function calculateLevelProgress(userXP) {
  const levelXPDistribution = await calculateLevelXPDistribution();

  const currentLevel = await determineUserLevel(userXP);
  const previousXP = currentLevel === 0 ? 0 : levelXPDistribution[currentLevel - 1];
  const currentLevelXP = levelXPDistribution[currentLevel] - previousXP;

  return ((userXP - previousXP) / currentLevelXP) * 100;
}

export async function getUserProgressReport(userId) {
  const userService = new UserService();
  const user = await userService.getUserById(userId);

  if (!user) throw new Error('Usuário não encontrado');

  const progress = await calculateLevelProgress(user.xp);
  const nextRole = ROLES[user.level] || ROLES[ROLES.length - 1];

  return {
    currentXP: user.xp,
    currentLevel: user.level,
    progressPercentage: progress,
    nextRole
  };
}
