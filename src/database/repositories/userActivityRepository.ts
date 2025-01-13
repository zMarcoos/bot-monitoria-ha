import { query } from "#database";
import { UserActivityData } from "#database/interfaces/ActivityData.js";

export const userActivityRepository = {
  async getActivityById(id: number, userId: string): Promise<UserActivityData | null> {
    const rows = await query(
      `SELECT * FROM user_activities WHERE activity_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (rows.length > 0) {
      const activity = rows[0];

      return {
        id: activity.id,
        userId: activity.user_id,
        activityId: activity.activity_id,
        content: activity.content,
        dateCompleted: activity.date_completed ? new Date(activity.date_completed) : null,
        submissionDate: new Date(activity.submission_date),
      };
    }

    return null;
  },

  async createActivity(activity: Partial<UserActivityData>): Promise<void> {
    await query(
      `INSERT INTO user_activities (activity_id, user_id, content, date_completed, submission_date)
        VALUES ($1, $2, $3, $4, $5)`,
      [
        activity.activityId,
        activity.userId,
        activity.content,
        activity.dateCompleted ?? null,
        activity.submissionDate ?? new Date(),
      ]
    );
  },

  async getAllActivitiesByUserId(userId: string): Promise<UserActivityData[]> {
    const rows = await query(
      `SELECT * FROM user_activities WHERE user_id = $1`,
      [userId]
    );

    return rows.map((activity) => ({
      id: activity.id,
      userId: activity.user_id,
      activityId: activity.activity_id,
      content: activity.content,
      dateCompleted: activity.date_completed ? new Date(activity.date_completed) : null,
      submissionDate: new Date(activity.submission_date),
    }));
  },
};
