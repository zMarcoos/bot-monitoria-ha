import { query } from "#database";
import { ActivityData } from "#database/interfaces/ActivityData.js";

export async function createActivity(activity: Omit<ActivityData, "id">): Promise<ActivityData> {
  const rows = await query(
    `INSERT INTO activities (title, type, description, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;`,
    [activity.title, activity.type, activity.description, activity.createdAt, activity.expiresAt]
  );

  return rows[0];
}

export async function getActivityById(id: number): Promise<ActivityData | null> {
  const rows = await query(`SELECT * FROM activities WHERE id = $1`, [id]);

  if (rows.length > 0) {
    const activity = rows[0];

    return {
      id: activity.id,
      title: activity.title,
      type: activity.type,
      description: activity.description,
      createdAt: new Date(activity.created_at),
      expiresAt: new Date(activity.expires_at),
    };
  }

  return null;
}


export async function getAllActivities(): Promise<ActivityData[]> {
  return await query(`SELECT * FROM activities ORDER BY created_at DESC`);
}

export async function deleteActivity(id: number): Promise<void> {
  await query(`DELETE FROM activities WHERE id = $1`, [id]);
}