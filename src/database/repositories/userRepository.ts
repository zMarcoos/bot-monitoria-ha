import { query } from "#database";
import { UserData } from "#database/interfaces/UserData.js";

export async function getAllUsers(): Promise<UserData[]> {
  return query(`SELECT * FROM users`);
}

export async function createUser(user: UserData) {
  await query(
    `INSERT INTO users (id, enrollment, course, character, xp, level, role, streak, max_streak, last_activity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      user.id,
      user.enrollment,
      user.course,
      user.character,
      user.xp,
      user.level,
      user.role,
      user.streak,
      user.maxStreak,
      user.lastActivity,
    ]
  );
}

export async function getUserById(id: string): Promise<UserData | null> {
  const rows = await query(`SELECT * FROM users WHERE id = $1`, [id]);

  if (rows.length > 0) {
    const user = rows[0];
    
    return {
      id: user.id,
      enrollment: user.enrollment,
      course: user.course,
      character: user.character,
      xp: user.xp,
      level: user.level,
      role: user.role,
      streak: user.streak,
      maxStreak: user.max_streak,
      lastActivity: user.last_activity ? new Date(user.last_activity) : null
    };
  }

  return null;
}
