import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const query = async (sql: string, params: any[] = []) => {
  const client = await pool.connect();

  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
};

const initializeDatabase = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        enrollment VARCHAR(10) NOT NULL UNIQUE,
        course VARCHAR(50) NOT NULL,
        character VARCHAR(10),
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        role VARCHAR(100) DEFAULT 'Aprendiz de Algoritmos',
        streak INTEGER DEFAULT 0,
        max_streak INTEGER DEFAULT 0,
        last_activity TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
        content TEXT,
        date_completed TIMESTAMP DEFAULT NULL,
        submission_date TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Tabelas criadas com sucesso!");
  } catch (error: any) {
    console.error("Erro ao criar tabelas:", error.message);
  }
};

initializeDatabase();
