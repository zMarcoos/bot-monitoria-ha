import database from '../database/firebase.js';
import Joi from 'joi';

export default class ActivityService {
  constructor(collectionName = 'atividades') {
    this.collection = database.collection(collectionName);
  }

  activitySchema = Joi.object({
    title: Joi.string().required().messages({
      'string.base': `"title" deve ser um texto`,
      'any.required': `"title" é um campo obrigatório`
    }),
    type: Joi.string().valid('pratico', 'desafio', 'trabalho').required().messages({
      'string.base': `"type" deve ser um texto`,
      'any.only': `"type" deve ser "pratico", "desafio" ou "trabalho"`,
      'any.required': `"type" é um campo obrigatório`
    }),
    description: Joi.string().optional().messages({
      'string.base': `"description" deve ser um texto`
    }),
    completedBy: Joi.array().items(Joi.string()).default([]).messages({
      'array.base': `"completedBy" deve ser uma lista de IDs de usuários`
    }),
    createdAt: Joi.date().default(() => new Date()).messages({
      'date.base': `"createdAt" deve ser uma data`
    })
  });

  async getNextActivityId() {
    const snapshot = await this.collection.get();
    const nextId = snapshot.size + 1;
    return nextId.toString();
  }

  async getLastActivity() {
    const snapshot = await this.collection.orderBy('createdAt', 'desc').limit(1).get();
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }

  async addActivity(activityData) {
    const { error } = this.activitySchema.validate(activityData);
    if (error) {
      console.error('Dados inválidos para atividade:', error.details[0].message);
      return;
    }

    try {
      const activityId = await this.getNextActivityId();
      const newActivityRef = this.collection.doc(activityId);
      await newActivityRef.set(activityData);
      console.info(`Atividade "${activityData.title}" adicionada com sucesso com o ID ${activityId}.`);
    } catch (error) {
      console.error('Erro ao adicionar atividade:', error);
    }
  }

  async listActivities() {
    try {
      const snapshot = await this.collection.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Erro ao listar atividades:', error);
      return [];
    }
  }

  async getActivity(activityId) {
    try {
      const doc = await this.collection.doc(activityId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
      console.error('Erro ao buscar atividade:', error);
      return null;
    }
  }

  async linkActivityToUser(activityId, userId) {
    try {
      const userRef = database.collection('usuarios').doc(userId);
      const activityRef = this.collection.doc(activityId);

      const userDoc = await userRef.get();
      const activityDoc = await activityRef.get();

      if (!userDoc.exists || !activityDoc.exists) {
        console.error('Usuário ou atividade não encontrados.');
        return;
      }

      const userActivities = userDoc.data().activityHistory || [];
      userActivities.push({ activityId, dateCompleted: new Date() });

      await userRef.update({ activityHistory: userActivities });
      console.info(`Atividade ${activityId} vinculada ao usuário ${userId}.`);
    } catch (error) {
      console.error('Erro ao vincular atividade ao usuário:', error);
    }
  }
}
