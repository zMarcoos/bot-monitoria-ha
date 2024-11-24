import Joi from 'joi';
import { FieldValue } from 'firebase-admin/firestore';
import database from '../firebase.js';
import ActivityService from './activityService.js';
import { ROLES, determineUserLevel, calculateUserExperience } from '../../levelling/level.js';
import CustomError from '../../exceptions/customError.js';

export default class UserService {
  constructor(collectionName = 'usuarios') {
    this.collection = database.collection(collectionName);
  }

  userSchema = Joi.object({
    enrollment: Joi.string().required().messages({
      'string.base': `"enrollment" deve ser um texto`,
      'any.required': `"enrollment" é um campo obrigatório`,
    }),
    xp: Joi.number().integer().min(0).default(0).messages({
      'number.base': `"xp" deve ser um número`,
      'number.min': `"xp" não pode ser negativo`,
    }),
    level: Joi.number().integer().min(0).default(0).messages({
      'number.base': `"level" deve ser um número`,
      'number.min': `"level" deve ser no mínimo 0`,
    }),
    role: Joi.string().default('Aprendiz de Algoritmos').messages({
      'string.base': `"role" deve ser um texto`,
    }),
    activityHistory: Joi.array().items(Joi.object()).default([]).messages({
      'array.base': `"activityHistory" deve ser uma lista`,
    }),
    streak: Joi.number().integer().min(0).default(0).messages({
      'number.base': `"streak" deve ser um número`,
      'number.min': `"streak" não pode ser negativo`,
    }),
    maxStreak: Joi.number().integer().min(0).default(0).messages({
      'number.base': `"maxStreak" deve ser um número`,
      'number.min': `"maxStreak" não pode ser negativo`,
    }),
    lastActivity: Joi.date().allow(null).default(null).messages({
      'date.base': `"lastActivity" deve ser uma data`,
    }),
    badges: Joi.array().items(Joi.string()).default([]).messages({
      'array.base': `"badges" deve ser uma lista de textos`,
    }),
    character: Joi.string().valid('Finn', 'Jake').required().messages({
      'string.base': `"character" deve ser um texto`,
      'any.only': `"character" deve ser "Finn" ou "Jake"`,
      'any.required': `"character" é um campo obrigatório`,
    }),
  });

  async getUser(userId) {
    try {
      return (await this.collection.doc(userId).get()).data() || null;
    } catch (error) {
      throw new CustomError(
        'Erro ao buscar usuário',
        `Não foi possível buscar o usuário com ID ${userId}.`,
        { code: 500 }
      );
    }
  }

  async addUser(userId, userData) {
    const { error } = this.userSchema.validate(userData);
    if (error) {
      throw new CustomError(
        'Erro de validação',
        `Os dados fornecidos para o usuário ${userId} são inválidos: ${error.details.map(err => err.message).join(', ')}`,
        { code: 400 }
      );
    }

    try {
      if (await this.getUser(userId)) {
        throw new CustomError(
          'Usuário duplicado',
          `O usuário com ID ${userId} já existe no banco de dados.`,
          { code: 409 }
        );
      }

      await this.collection.doc(userId).set(userData);
      console.info(`Usuário com ID ${userId} adicionado com sucesso.`);
    } catch (error) {
      throw new CustomError(
        'Erro ao adicionar usuário',
        `Não foi possível adicionar o usuário com ID ${userId}.`,
        { code: 500 }
      );
    }
  }

  async removeUser(userId) {
    try {
      await this.collection.doc(userId).delete();
      console.info(`Usuário com ID ${userId} removido com sucesso.`);
    } catch (error) {
      throw new CustomError(
        'Erro ao remover usuário',
        `Não foi possível remover o usuário com ID ${userId}.`,
        { code: 500 }
      );
    }
  }

  async listUsers() {
    try {
      const snapshot = await this.collection.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new CustomError(
        'Erro ao listar usuários',
        'Não foi possível recuperar a lista de usuários.',
        { code: 500 }
      );
    }
  }

  async updateUser(userId, updatedData) {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        throw new CustomError(
          'Usuário não encontrado',
          `Usuário com ID ${userId} não foi encontrado.`,
          { code: 404 }
        );
      }

      await this.collection.doc(userId).update(updatedData);
      console.info(`Usuário com ID ${userId} atualizado com sucesso.`);
    } catch (error) {
      CustomError.logger(error, 'updateUser');
      throw new CustomError(
        'Erro ao atualizar usuário',
        `Não foi possível atualizar o usuário com ID ${userId}.`,
        { code: 500 }
      );
    }
  }

  async addActivityToUser(userId, activity) {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        throw new CustomError(
          'Usuário não encontrado',
          `Usuário com ID ${userId} não foi encontrado.`,
          { code: 404 }
        );
      }

      if (user.activityHistory.some(thisActivity => thisActivity.id === activity.id)) {
        throw new CustomError(
          'Atividade duplicada',
          `O usuário ${userId} já completou a atividade com ID ${activity.id}.`,
          { code: 409 }
        );
      }

      const updatedActivity = {
        id: activity.id,
        title: activity.title,
        type: activity.type,
        dateCompleted: new Date(),
      };

      const updatedActivities = [...user.activityHistory, updatedActivity];
      const updatedExperience = await calculateUserExperience(updatedActivities);
      const level = await determineUserLevel(updatedExperience);
      const role = ROLES[level - 1] || ROLES[ROLES.length - 1];

      const activityService = new ActivityService();
      const allActivities = (await activityService.listActivities()).sort((a, b) => a.createdAt - b.createdAt);

      let newStreak = user.streak || 0;
      let maxStreak = user.maxStreak || 0;

      if (user.activityHistory.length > 0) {
        const lastCompletedActivityId = user.activityHistory[user.activityHistory.length - 1].id;
        const lastCompletedIndex = allActivities.findIndex(act => act.id === lastCompletedActivityId);
        const currentActivityIndex = allActivities.findIndex(act => act.id === activity.id);

        newStreak = currentActivityIndex === lastCompletedIndex + 1 ? newStreak + 1 : 1;
      } else {
        newStreak = 1;
      }

      maxStreak = Math.max(newStreak, maxStreak);

      await this.collection.doc(userId).update({
        activityHistory: FieldValue.arrayUnion(updatedActivity),
        xp: updatedExperience,
        level,
        role: role.name,
        streak: newStreak,
        maxStreak,
        lastActivity: FieldValue.serverTimestamp(),
      });

      await database.collection('atividades').doc(activity.id).update({
        completedBy: FieldValue.arrayUnion(userId),
      });

      console.info(
        `Atividade ${activity.id} vinculada ao usuário ${userId}. XP: ${updatedExperience}, Nível: ${level}, Cargo: ${role.name}, Streak Atual: ${newStreak}, MaxStreak: ${maxStreak}`
      );

      return { xp: updatedExperience, level, role };
    } catch (error) {
      throw new CustomError(
        'Erro ao adicionar atividade',
        `Não foi possível adicionar a atividade ao usuário ${userId}.`,
        { code: 500 }
      );
    }
  }
}
