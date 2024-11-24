import twilio from 'twilio';

const client = twilio('AC73ca1829944fc79d225a50697889b9ab', '827a884b19bca48565db0b34b2b3a810');

export async function sendWhatsappMessage(bodyMessage) {
  try {
      const message = await client.messages.create({
        body: bodyMessage,
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+558899155613'
      });

      console.log(`Mensagem enviada com sucesso: SID -> ${message.sid}`);
  } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
  }
};