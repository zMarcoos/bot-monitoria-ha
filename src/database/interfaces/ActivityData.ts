export interface ActivityData {
    id: number;
    title: string;
    type: string;
    description: string;
    createdAt: Date;
    expiresAt: Date;
}

export interface UserActivityData {
    id: number;
    userId: string;
    activityId: number;
    content: string;
    dateCompleted: Date | null;
    submissionDate: Date;
}