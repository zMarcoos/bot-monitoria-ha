import database from '../firebase.js';
import Joi from 'joi';

export default class ActivityService {
  constructor(collectionName = 'atividades') {
    this.collection = database.collection(collectionName);
  }

  activitySchema = Joi.object({
    title: Joi.string().required().messages({
      'string.base': `"title" deve ser um texto`,
      'any.required': `"title" é um campo obrigatório`,
    }),
    type: Joi.string().valid('pratico', 'desafio', 'trabalho').required().messages({
      'string.base': `"type" deve ser um texto`,
      'any.only': `"type" deve ser "pratico", "desafio" ou "trabalho"`,
      'any.required': `"type" é um campo obrigatório`,
    }),
    description: Joi.string().optional().messages({
      'string.base': `"description" deve ser um texto`,
    }),
    completed: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().required().messages({
            'string.base': `"userId" deve ser um texto`,
            'any.required': `"userId" é obrigatório no objeto "completed"`,
          }),
          dateCompleted: Joi.date().default(() => new Date()).messages({
            'date.base': `"dateCompleted" deve ser uma data`,
          }),
          content: Joi.string().required().messages({
            'string.base': `"content" deve ser um texto`,
            'any.required': `"content" é obrigatório no objeto "completed"`,
          }),
        })
      )
      .default([])
      .messages({
        'array.base': `"completed" deve ser uma lista de objetos com "userId", "dateCompleted" e "content"`,
      }),
    pending: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().required().messages({
            'string.base': `"userId" deve ser um texto`,
            'any.required': `"userId" é obrigatório no objeto "pending"`,
          }),
          submissionDate: Joi.date().default(() => new Date()).messages({
            'date.base': `"submissionDate" deve ser uma data`,
          }),
          content: Joi.string().required().messages({
            'string.base': `"content" deve ser um texto`,
            'any.required': `"content" é obrigatório no objeto "pending"`,
          }),
        })
      )
      .default([])
      .messages({
        'array.base': `"pending" deve ser uma lista de objetos com "userId", "submissionDate" e "content"`,
      }),
    createdAt: Joi.date().default(() => new Date()).messages({
      'date.base': `"createdAt" deve ser uma data`,
    }),
    deadline: Joi.date().optional().messages({
      'date.base': `"deadline" deve ser uma data válida`,
    }),
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
    const { error, value } = this.activitySchema.validate(activityData, { stripUnknown: true });
    if (error) {
      console.error('Dados inválidos para atividade:', error.details[0].message);
      return;
    }

    try {
      const activityId = await this.getNextActivityId();
      const newActivityRef = this.collection.doc(activityId);
      await newActivityRef.set(value);
      console.info(`Atividade "${activityData.title}" adicionada com sucesso com o ID ${activityId}.`);
    } catch (error) {
      console.error('Erro ao adicionar atividade:', error);
    }
  }

  async approveSubmission(activityId, userId) {
    try {
      const activityRef = this.collection.doc(activityId);
      const activityDoc = await activityRef.get();

      if (!activityDoc.exists) {
        throw new Error('Atividade não encontrada.');
      }

      const activityData = activityDoc.data();
      const pending = activityData.pending || [];
      const completed = activityData.completed || [];

      if (activityData.deadline && new Date() > new Date(activityData.deadline)) {
        throw new Error('A atividade está fora do prazo.');
      }

      const submissionIndex = pending.findIndex(submission => submission.userId === userId);

      if (submissionIndex === -1) {
        throw new Error('Submissão pendente não encontrada para o usuário.');
      }

      const [submission] = pending.splice(submissionIndex, 1);
      completed.push(submission);

      await activityRef.update({ pending, completed });

      console.info(`Submissão aprovada: ${userId} para a atividade ${activityId}.`);
    } catch (error) {
      console.error('Erro ao aprovar submissão:', error.message);
      throw new Error('Erro ao aprovar submissão.');
    }
  }

  async rejectSubmission(activityId, userId) {
    try {
      const activityRef = this.collection.doc(activityId);
      const activityDoc = await activityRef.get();

      if (!activityDoc.exists) {
        throw new Error('Atividade não encontrada.');
      }

      const activityData = activityDoc.data();
      const pending = activityData.pending || [];

      const submissionIndex = pending.findIndex(submission => submission.userId === userId);

      if (submissionIndex === -1) {
        throw new Error('Submissão pendente não encontrada para o usuário.');
      }

      pending.splice(submissionIndex, 1);

      await activityRef.update({ pending });

      console.info(`Submissão rejeitada: ${userId} para a atividade ${activityId}.`);
    } catch (error) {
      console.error('Erro ao rejeitar submissão:', error.message);
      throw new Error('Erro ao rejeitar submissão.');
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

  async addPendingResponse(activityId, pendingData) {
    try {
      const activityRef = this.collection.doc(activityId);
      const activityDoc = await activityRef.get();

      if (!activityDoc.exists) {
        throw new Error('Atividade não encontrada.');
      }

      const activityData = activityDoc.data();
      const pending = activityData.pending || [];
      const completed = activityData.completed || [];

      if (activityData.deadline && new Date() > new Date(activityData.deadline)) {
        throw new Error('A atividade está fora do prazo e não pode mais receber respostas.');
      }

      const alreadyCompleted = completed.some(completion => completion.userId === pendingData.userId);
      if (alreadyCompleted) {
        throw new Error('O usuário já completou esta atividade.');
      }

      const alreadyPending = pending.some(submission => submission.userId === pendingData.userId);
      if (alreadyPending) {
        throw new Error('O usuário já possui uma submissão pendente para esta atividade.');
      }

      pending.push(pendingData);

      await activityRef.update({ pending });

      console.info(`Resposta pendente adicionada para a atividade ${activityId}.`);
    } catch (error) {
      console.error(`Erro ao adicionar resposta pendente: ${error.message}`);
      throw new Error(`Erro ao adicionar resposta pendente: ${error.message}`);
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
