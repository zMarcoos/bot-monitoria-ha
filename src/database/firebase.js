import admin from 'firebase-admin';
import fs from 'fs';

try {
  const serviceAccount = JSON.parse(
    fs.readFileSync(new URL('../../serviceAccountKey.json', import.meta.url))
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('Firebase inicializado com sucesso.');
} catch (error) {
  console.error('Erro ao carregar o arquivo de credenciais:', error.message);
}

export default admin.firestore();
