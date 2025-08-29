const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const mysql = require('mysql2/promise');

// Conexão MySQL
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'faltei'
});

// Porta serial do Arduino
const port = new SerialPort({ path: 'COM4', baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

parser.on('data', async (data) => {
  const uid = data.trim();
  console.log('UID recebido:', uid);

  try {
    // 1️⃣ Busca usuário
    const [usuarios] = await db.query('SELECT * FROM usuarios WHERE uid = ?', [uid]);
    if (usuarios.length === 0) {
      console.log('UID não cadastrado no banco.');
      return;
    }
    const usuario = usuarios[0];

    // 2️⃣ Busca última presença
    const [presencas] = await db.query(
      'SELECT data_hora FROM presencas WHERE usuario_id = ? ORDER BY data_hora DESC LIMIT 1',
      [usuario.id]
    );

    const agora = new Date();

    if (presencas.length === 0 || (agora - new Date(presencas[0].data_hora)) >= 120000) {
      // 3️⃣ Insere nova presença
      await db.query('INSERT INTO presencas (usuario_id, data_hora) VALUES (?, ?)', [usuario.id, agora]);
      console.log(`Presença registrada para ${usuario.nome} às ${agora}`);
    } else {
      console.log(`Ainda não passaram 2m desde a última presença de ${usuario.nome}.`);
    }

  } catch (err) {
    console.error('Erro no banco de dados:', err);
  }
});

port.on('open', () => console.log('Conexão com Arduino estabelecida.'));
port.on('error', (err) => console.error('Erro na porta serial:', err.message));
