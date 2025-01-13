export interface UserData {
    id: string;
    enrollment: string;
    course: string;
    character: string;
    xp: number;
    level: number;
    role: string;
    streak: number;
    maxStreak: number;
    lastActivity: Date | null;
}
