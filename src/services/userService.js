import Joi from 'joi';
import { FieldValue } from 'firebase-admin/firestore';
import database from '../database/firebase.js';
import ActivityService from './activityService.js';
import { calculateUserExperience, calculateDynamicLevel } from '../levelling/level.js';
import { differenceInDays } from 'date-fns';
import client from '../index.js';

export default class UserService {
  constructor(collectionName = 'usuarios') {
    this.collection = database.collection(collectionName);
  }

  userSchema = Joi.object({
    enrollment: Joi.string().required().messages({
      'string.base': `"enrollment" deve ser um texto`,
      'any.required': `"enrollment" é um campo obrigatório`
    }),
    name: Joi.string().required().messages({
      'string.base': `"name" deve ser um texto`,
      'any.required': `"name" é um campo obrigatório`
    }),
    xp: Joi.number().integer().min(0).required().messages({
      'number.base': `"xp" deve ser um número`,
      'number.min': `"xp" não pode ser negativo`,
      'any.required': `"xp" é um campo obrigatório`
    }),
    level: Joi.number().integer().min(1).required().messages({
      'number.base': `"level" deve ser um número`,
      'number.min': `"level" deve ser no mínimo 1`,
      'any.required': `"level" é um campo obrigatório`
    }),
    role: Joi.string().required().messages({
      'string.base': `"role" deve ser um texto`,
      'any.required': `"role" é um campo obrigatório`
    }),
    activityHistory: Joi.array().items(Joi.object()).default([]).messages({
      'array.base': `"activityHistory" deve ser uma lista`
    }),
    streak: Joi.number().integer().min(0).required().messages({
      'number.base': `"streak" deve ser um número`,
      'number.min': `"streak" não pode ser negativo`,
      'any.required': `"streak" é um campo obrigatório`
    }),
    maxStreak: Joi.number().integer().min(0).required().messages({
      'number.base': `"maxStreak" deve ser um número`,
      'number.min': `"maxStreak" não pode ser negativo`
    }),
    lastActivity: Joi.date().allow(null).messages({
      'date.base': `"lastActivity" deve ser uma data`
    }),
    badges: Joi.array().items(Joi.string()).default([]).messages({
      'array.base': `"badges" deve ser uma lista de textos`
    }),
    character: Joi.string().valid('Finn', 'Jake').required().messages({
      'string.base': `"character" deve ser um texto`,
      'any.only': `"character" deve ser "Finn" ou "Jake"`,
      'any.required': `"character" é um campo obrigatório`
    })
  });

  async getUser(userId) {
    try {
      return (await this.collection.doc(userId).get()).data() || null;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  async addUser(userId, userData) {
    const { error } = this.userSchema.validate(userData);
    if (error) {
      console.error('Erro de validação ao adicionar usuário:', error.details.map(err => err.message));
      return;
    }

    try {
      if (await this.getUser(userId)) {
        console.error('Usuário já existe no banco de dados.');
        return;
      }

      await this.collection.doc(userId).set(userData);
      console.info(`Usuário adicionado com sucesso no banco de dados.`);
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
    }
  }

  async removeUser(userId) {
    try {
      await this.collection.doc(userId).delete();
      console.log(`Usuário com ID ${userId} removido com sucesso.`);
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
    }
  }

  async listUsers() {
    try {
      const snapshot = await this.collection.get();
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return users;
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return [];
    }
  }

  async updateUser(userId, updatedData) {
    try {
      if (!(await this.getUser(userId))) return;

      await this.collection.doc(userId).update(updatedData);
      console.log(`Usuário com ID ${userId} atualizado com sucesso.`);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
    }
  }

  async addActivityToUser(userId, activityId) {
    const user = await this.getUser(userId);
    if (!user) {
      console.error('Usuário não encontrado.');
      return;
    }

    const activityService = new ActivityService();
    const activity = await activityService.getActivity(activityId);
    if (!activity) {
      console.error('Atividade não encontrada.');
      return;
    }

    if (user.activityHistory.some(thisActivity => thisActivity.id === activityId)) {
      console.error('Usuário já fez essa atividade.');
      return;
    }

    const updatedActivity = { id: activityId, title: activity.title, type: activity.type, dateCompleted: new Date() };
    const updatedActivities = [...user.activityHistory, updatedActivity];
    const updatedExperience = await calculateUserExperience(updatedActivities);
    const { level, role, levelUp } = await calculateDynamicLevel(updatedExperience, user.level);

    let newStreak = user.streak || 0;
    let maxStreak = user.maxStreak || 0;

    const activities = await activityService.listActivities();
    const lastActivity = activities[activities.length - 1];
    if (lastActivity.id === activityId) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    maxStreak = Math.max(newStreak, maxStreak);

    await this.collection.doc(userId).update({
      activityHistory: FieldValue.arrayUnion(updatedActivity),
      xp: updatedExperience,
      level,
      role,
      streak: newStreak,
      maxStreak,
      lastActivity: FieldValue.serverTimestamp(),
    });

    await database.collection('atividades').doc(activityId).update({
      completedBy: FieldValue.arrayUnion(userId),
    });

    console.log(`Atividade vinculada ao usuário ${userId}. XP: ${updatedExperience}, Nível: ${level}, Cargo: ${role}, Streak Atual: ${newStreak}, MaxStreak: ${maxStreak}`);

    const channel = client.channels.cache.get('1298472460156403752');
    if (!channel) return;

    if (levelUp) {
      try {
        await channel.send(`🎉 ${user.name} completou a atividade "${activity.title}" e subiu para o nível ${level}! 🎉`);
      } catch (error) {
        console.error('Erro ao enviar mensagem de atividade:', error);
      }
    }
  }
}
