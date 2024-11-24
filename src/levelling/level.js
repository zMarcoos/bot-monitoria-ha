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
  { name: 'Feiticeiro Alado', id: '1310339027928616960' },
  { name: 'Mago Mestre do Código', id: '1309353865539223563' },
];

let levelXPDistributionCached = null;

export async function calculateLevelXPDistribution(recalculate = false) {
  if (!recalculate && levelXPDistributionCached) return levelXPDistributionCached;

  const activityService = new ActivityService();
  try {
    const allActivities = await activityService.listActivities() || [];
    console.log('Atividades recuperadas:', allActivities);

    const activityCounts = allActivities.reduce((accumulator, activity) => {
      accumulator[activity.type] = (accumulator[activity.type] || 0) + 1;
      return accumulator;
    }, {});

    const levels = ROLES.length;

    const totalXP = Object.entries(activityCounts).reduce((total, [type, count]) => {
      return total + (XP_VALUES[type] || 0) * count;
    }, 0);
    if (totalXP === 0) {
      console.warn('Nenhuma atividade disponível para calcular XP.');
      return Array.from({ length: levels }, () => 0);
    }

    console.log('XP total calculado:', totalXP);

    const xpPerLevel = Math.ceil(totalXP / (levels - 1)); // Último nível é exatamente o XP total
    const levelBoundaries = Array.from({ length: levels }, (_, index) => xpPerLevel * index);

    // Ajusta o limite superior ao total de XP
    levelBoundaries[levels - 1] = totalXP;

    console.log('Faixas de XP por nível (calculadas automaticamente):', levelBoundaries);

    levelXPDistributionCached = levelBoundaries;
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

    console.log('Distribuição de XP atual:', levelXPDistribution);
    console.log('XP do usuário:', userXP);

    for (let level = 0; level < levelXPDistribution.length - 1; level++) {
      if (userXP >= levelXPDistribution[level] && userXP < levelXPDistribution[level + 1]) {
        console.log(`Nível determinado: ${level} para XP: ${userXP}`);
        return level;
      }
    }

    if (userXP === levelXPDistribution[levelXPDistribution.length - 1]) {
      const maxLevel = levelXPDistribution.length - 1;
      console.log(`Nível máximo alcançado: ${maxLevel}`);
      return maxLevel;
    }

    console.warn('XP fora da faixa esperada:', userXP);
    return 0;
  } catch (error) {
    console.error('Erro em determineUserLevel:', error);
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

    console.log('Nível atual:', currentLevel);
    console.log('XP anterior ao nível atual:', previousXP);
    console.log('XP necessário para o próximo nível:', currentLevelXP);

    const progress = currentLevelXP === 0 ? 100 : ((userXP - previousXP) / currentLevelXP) * 100;

    console.log(`Progresso de nível: ${progress}%`);

    return progress;
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

    if (isNaN(user.xp) || user.xp < 0) {
      throw new CustomError(
        'Dados de usuário inválidos',
        `O XP do usuário ${userId} é inválido: ${user.xp}.`,
        { code: 400 }
      );
    }

    const progress = await calculateLevelProgress(user.xp);

    const currentRole = ROLES[user.level] || ROLES[0];
    const nextRole = ROLES[user.level + 1] || null;

    console.log(`Relatório de progresso para o usuário ${userId}`);
    console.log('XP Atual:', user.xp);
    console.log('Nível Atual:', user.level);
    console.log('Cargo Atual:', currentRole?.name);
    console.log('Próximo Cargo:', nextRole?.name || 'Nenhum');

    return {
      currentXP: user.xp,
      currentLevel: user.level,
      progressPercentage: progress,
      currentRole,
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
