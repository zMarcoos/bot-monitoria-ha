import database from '../firebase.js';
import Joi from 'joi';
import CustomError from '../../exceptions/customError.js';

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
    try {
      const snapshot = await this.collection.get();
      return (snapshot.size + 1).toString();
    } catch (error) {
      throw new CustomError(
        'Erro ao gerar ID de atividade',
        'Não foi possível calcular o próximo ID para atividades.',
        { code: 500 }
      );
    }
  }

  async getLastActivity() {
    try {
      const snapshot = await this.collection.orderBy('createdAt', 'desc').limit(1).get();
      return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (error) {
      throw new CustomError(
        'Erro ao buscar última atividade',
        'Não foi possível recuperar a última atividade registrada.',
        { code: 500 }
      );
    }
  }

  async addActivity(activityData) {
    const { error, value } = this.activitySchema.validate(activityData, { stripUnknown: true });
    if (error) {
      throw new CustomError(
        'Erro de validação de atividade',
        `Os dados fornecidos para a atividade são inválidos: ${error.details.map(err => err.message).join(', ')}`,
        { code: 400 }
      );
    }

    try {
      const activityId = await this.getNextActivityId();
      await this.collection.doc(activityId).set(value);
      console.info(`Atividade "${activityData.title}" adicionada com sucesso com o ID ${activityId}.`);
    } catch (error) {
      throw new CustomError(
        'Erro ao adicionar atividade',
        `Não foi possível adicionar a atividade "${activityData.title}".`,
        { code: 500 }
      );
    }
  }

  async approveSubmission(activityId, userId) {
    try {
      const activityRef = this.collection.doc(activityId);
      const activityDoc = await activityRef.get();

      if (!activityDoc.exists) {
        throw new CustomError(
          'Atividade não encontrada',
          `A atividade com ID ${activityId} não foi encontrada.`,
          { code: 404 }
        );
      }

      const activityData = activityDoc.data();
      const pending = activityData.pending || [];
      const completed = activityData.completed || [];

      const submissionIndex = pending.findIndex(submission => submission.userId === userId);

      if (submissionIndex === -1) {
        throw new CustomError(
          'Submissão pendente não encontrada',
          `Submissão pendente para o usuário ${userId} não foi encontrada.`,
          { code: 404 }
        );
      }

      const [submission] = pending.splice(submissionIndex, 1);
      completed.push(submission);

      await activityRef.update({ pending, completed });

      console.info(`Submissão aprovada: ${userId} para a atividade ${activityId}.`);
    } catch (error) {
      throw new CustomError(
        'Erro ao aprovar submissão',
        `Não foi possível aprovar a submissão do usuário ${userId} para a atividade ${activityId}.`,
        { code: 500 }
      );
    }
  }

  async rejectSubmission(activityId, userId) {
    try {
      const activityRef = this.collection.doc(activityId);
      const activityDoc = await activityRef.get();

      if (!activityDoc.exists) {
        throw new CustomError(
          'Atividade não encontrada',
          `A atividade com ID ${activityId} não foi encontrada.`,
          { code: 404 }
        );
      }

      const activityData = activityDoc.data();
      const pending = activityData.pending || [];

      const submissionIndex = pending.findIndex(submission => submission.userId === userId);

      if (submissionIndex === -1) {
        throw new CustomError(
          'Submissão pendente não encontrada',
          `Submissão pendente para o usuário ${userId} não foi encontrada.`,
          { code: 404 }
        );
      }

      pending.splice(submissionIndex, 1);

      await activityRef.update({ pending });

      console.info(`Submissão rejeitada: ${userId} para a atividade ${activityId}.`);
    } catch (error) {
      throw new CustomError(
        'Erro ao rejeitar submissão',
        `Não foi possível rejeitar a submissão do usuário ${userId} para a atividade ${activityId}.`,
        { code: 500 }
      );
    }
  }

  async listActivities() {
    try {
      const snapshot = await this.collection.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new CustomError(
        'Erro ao listar atividades',
        'Não foi possível recuperar a lista de atividades.',
        { code: 500 }
      );
    }
  }

  async addPendingResponse(activityId, pendingData) {
    try {
      const activityRef = this.collection.doc(activityId);
      const activityDoc = await activityRef.get();

      if (!activityDoc.exists) {
        throw new CustomError(
          'Atividade não encontrada',
          `A atividade com ID ${activityId} não foi encontrada.`,
          { code: 404 }
        );
      }

      const activityData = activityDoc.data();
      const pending = activityData.pending || [];
      const completed = activityData.completed || [];

      if (activityData.deadline && new Date() > new Date(activityData.deadline)) {
        throw new CustomError(
          'Prazo expirado',
          `A atividade ${activityId} está fora do prazo.`,
          { code: 400 }
        );
      }

      if (completed.some(completion => completion.userId === pendingData.userId)) {
        throw new CustomError(
          'Atividade já completada',
          `O usuário ${pendingData.userId} já completou a atividade ${activityId}.`,
          { code: 409 }
        );
      }

      if (pending.some(submission => submission.userId === pendingData.userId)) {
        throw new CustomError(
          'Submissão pendente duplicada',
          `O usuário ${pendingData.userId} já possui uma submissão pendente para a atividade ${activityId}.`,
          { code: 409 }
        );
      }

      pending.push(pendingData);

      await activityRef.update({ pending });

      console.info(`Resposta pendente adicionada para a atividade ${activityId}.`);
    } catch (error) {
      throw new CustomError(
        'Erro ao adicionar resposta pendente',
        `Não foi possível adicionar a resposta pendente para a atividade ${activityId}.`,
        { code: 500 }
      );
    }
  }

  async getActivity(activityId) {
    try {
      const doc = await this.collection.doc(activityId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
      throw new CustomError(
        'Erro ao buscar atividade',
        `Não foi possível buscar a atividade com ID ${activityId}.`,
        { code: 500 }
      );
    }
  }

  async linkActivityToUser(activityId, userId) {
    try {
      const userRef = database.collection('usuarios').doc(userId);
      const activityRef = this.collection.doc(activityId);

      const userDoc = await userRef.get();
      const activityDoc = await activityRef.get();

      if (!userDoc.exists || !activityDoc.exists) {
        throw new CustomError(
          'Usuário ou atividade não encontrados',
          `Não foi possível encontrar o usuário ${userId} ou a atividade ${activityId}.`,
          { code: 404 }
        );
      }

      const userActivities = userDoc.data().activityHistory || [];
      userActivities.push({ activityId, dateCompleted: new Date() });

      await userRef.update({ activityHistory: userActivities });
      console.info(`Atividade ${activityId} vinculada ao usuário ${userId}.`);
    } catch (error) {
      throw new CustomError(
        'Erro ao vincular atividade ao usuário',
        `Não foi possível vincular a atividade ${activityId} ao usuário ${userId}.`,
        { code: 500 }
      );
    }
  }
}
