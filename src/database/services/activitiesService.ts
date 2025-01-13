import { query } from "#database";
import { log } from "#settings";
import { getUserById } from "#database/repositories/userRepository.js";
import { getActivityById } from "#database/repositories/activityRepository.js";
import { ROLES, calculateUserExperience, determineUserLevel } from "#functions/level.js";
import { UserData } from "#database/interfaces/UserData.js";

export const activitiesService = {
  async complete(activityId: number, userId: string): Promise<UserData | null> {
    const activity = await getActivityById(activityId);
    if (!activity) {
      log.error(`Atividade com ID ${activityId} não encontrada.`);
      return null;
    }

    const user = await getUserById(userId);
    if (!user) {
      log.error(`Usuário com ID ${userId} não encontrado.`);
      return null;
    }

    const userActivity = await query(
      `SELECT * FROM user_activities WHERE activity_id = $1 AND user_id = $2`,
      [activityId, userId]
    );

    if (!userActivity.length) {
      log.error(`Usuário ${userId} não submeteu a atividade ${activityId}.`);
      return null;
    }

    if (userActivity[0].date_completed) {
      log.error(`Usuário ${userId} já completou a atividade ${activityId}.`);
      return null;
    }

    const lastCompletedActivity = await query(
      `SELECT activity_id FROM user_activities WHERE user_id = $1 AND date_completed IS NOT NULL ORDER BY date_completed DESC LIMIT 1`,
      [userId]
    );

    const lastActivityId = lastCompletedActivity.length > 0 ? lastCompletedActivity[0].activity_id : null;

    let newStreak = 1;
    if (lastActivityId !== null && activityId === lastActivityId + 1) {
      newStreak = (user.streak || 0) + 1;
    }

    await query(
      `UPDATE user_activities SET date_completed = NOW() WHERE activity_id = $1 AND user_id = $2`,
      [activityId, userId]
    );

    const updatedExperience = await calculateUserExperience(userId);
    const updatedLevel = await determineUserLevel(updatedExperience);

    const role = ROLES[updatedLevel] || ROLES[ROLES.length - 1];

    const maxStreak = Math.max(user.maxStreak || 0, newStreak);

    await query(
      `UPDATE users SET xp = $1, level = $2, role = $3, streak = $4, max_streak = $5, last_activity = $6 WHERE id = $7`,
      [updatedExperience, updatedLevel, role.name, newStreak, maxStreak, new Date(), userId]
    );

    const updatedUser: UserData = {
      ...user,
      xp: updatedExperience,
      level: updatedLevel,
      role: role.name,
      streak: newStreak,
      maxStreak,
      lastActivity: new Date(),
    };

    log.log(
      `Atividade ${activityId} foi concluída pelo usuário ${userId}. XP: ${updatedExperience}, Nível: ${updatedLevel}, Cargo: ${role.name}, Streak Atual: ${newStreak}, MaxStreak: ${maxStreak}`
    );

    return updatedUser;
  },

  async fail(activityId: number, userId: string): Promise<void> {
    const activity = await getActivityById(activityId);
    if (!activity) {
      log.error(`Atividade com ID ${activityId} não encontrada.`);
      return;
    }

    await query(
      `DELETE FROM user_activities WHERE activity_id = $1 AND user_id = $2`,
      [activityId, userId]
    );

    log.log(`Atividade ${activityId} por ${userId} foi rejeitada.`);
  },
};
