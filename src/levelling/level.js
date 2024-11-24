import ActivityService from '../database/services/activityService.js';
import UserService from '../database/services/userService.js';
import CustomError from '../exceptions/customError.js';

export const XP_VALUES = {
  pratico: 10,
  desafio: 20,
  trabalho: 30,
};

export const ROLES = [
  { name: 'Aprendiz de Algoritmos', id: '1309353021490200627' },
  { name: 'Feiticeiro dos Dados', id: '1309353547237687337' },
  { name: 'Guardião dos Códigos', id: '1309353735578718239' },
  { name: 'Arcanista Digital', id: '1309354146494943232' },
  { name: 'Mago Mestre do Código', id: '1309353865539223563' },
];

let levelXPDistributionCached = null;

export async function calculateLevelXPDistribution(recalculate = false) {
  if (!recalculate && levelXPDistributionCached) return levelXPDistributionCached;

  const activityService = new ActivityService();
  try {
    const allActivities = await activityService.listActivities();

    if (!allActivities || allActivities.length === 0) {
      throw new CustomError(
        'Atividades não encontradas',
        'Nenhuma atividade foi recuperada do banco de dados para calcular a distribuição de XP.',
        { code: 404 }
      );
    }

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
  } catch (error) {
    throw new CustomError(
      'Erro ao calcular distribuição de XP',
      'Ocorreu um erro ao tentar calcular a distribuição de XP para os níveis.',
      { code: 500 }
    );
  }
}

export async function calculateUserExperience(userActivities) {
  try {
    return userActivities.reduce((totalXP, activity) => {
      return totalXP + (XP_VALUES[activity.type] || 0);
    }, 0);
  } catch (error) {
    throw new CustomError(
      'Erro ao calcular XP do usuário',
      'Ocorreu um erro ao tentar calcular a experiência do usuário.',
      { code: 500 }
    );
  }
}

export async function determineUserLevel(userXP) {
  try {
    const levelXPDistribution = await calculateLevelXPDistribution();

    for (let level = 0; level < levelXPDistribution.length; level++) {
      if (userXP < levelXPDistribution[level]) {
        return level;
      }
    }
    return levelXPDistribution.length;
  } catch (error) {
    throw new CustomError(
      'Erro ao determinar nível do usuário',
      'Ocorreu um erro ao tentar determinar o nível do usuário.',
      { code: 500 }
    );
  }
}

export async function calculateLevelProgress(userXP) {
  try {
    const levelXPDistribution = await calculateLevelXPDistribution();

    const currentLevel = await determineUserLevel(userXP);
    const previousXP = currentLevel === 0 ? 0 : levelXPDistribution[currentLevel - 1];
    const currentLevelXP = levelXPDistribution[currentLevel] - previousXP;

    return ((userXP - previousXP) / currentLevelXP) * 100;
  } catch (error) {
    throw new CustomError(
      'Erro ao calcular progresso de nível',
      'Ocorreu um erro ao tentar calcular o progresso de nível do usuário.',
      { code: 500 }
    );
  }
}

export async function getUserProgressReport(userId) {
  const userService = new UserService();
  try {
    const user = await userService.getUserById(userId);

    if (!user) {
      throw new CustomError(
        'Usuário não encontrado',
        `Usuário com ID ${userId} não foi encontrado no banco de dados.`,
        { code: 404 }
      );
    }

    const progress = await calculateLevelProgress(user.xp);
    const nextRole = ROLES[user.level] || ROLES[ROLES.length - 1];

    return {
      currentXP: user.xp,
      currentLevel: user.level,
      progressPercentage: progress,
      nextRole,
    };
  } catch (error) {
    throw new CustomError(
      'Erro ao recuperar relatório de progresso',
      'Ocorreu um erro ao tentar recuperar o relatório de progresso do usuário.',
      { code: 500 }
    );
  }
}
