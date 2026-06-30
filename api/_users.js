// ============================================================================
//  _users.js  —  Gestión de usuarios sobre Vercel KV (no es una ruta)
// ----------------------------------------------------------------------------
//  Requiere las variables de entorno que Vercel KV ya creó automáticamente al
//  conectar la base de datos al proyecto:
//    KV_REST_API_URL
//    KV_REST_API_TOKEN
//
//  Esquema de datos en KV:
//    user:{username}   ->  JSON con los datos del usuario (ver USER_SHAPE)
//    users:index        ->  Set con todos los usernames existentes
//
//  Contraseñas y respuestas de seguridad SIEMPRE se guardan con hash + sal
//  (scrypt), nunca en texto plano. La respuesta de seguridad se normaliza
//  (minúsculas, sin espacios extremos) antes de hashear, para que mayúsculas
//  o espacios accidentales no impidan recuperar la cuenta.
// ============================================================================

const crypto = require('crypto');
const { kv } = require('@vercel/kv');

const USER_PREFIX = 'user:';
const USERS_INDEX_KEY = 'users:index';

// USER_SHAPE (referencia, no se exporta como tipo real en JS):
// {
//   username: string,
//   passwordHash: string,
//   passwordSalt: string,
//   securityQuestion: string,
//   securityAnswerHash: string,
//   securityAnswerSalt: string,
//   createdAt: number,
//   updatedAt: number
// }

function hashWithSalt(value, salt) {
  return crypto.scryptSync(String(value), salt, 64).toString('hex');
}

function normalizeAnswer(answer) {
  return String(answer).trim().toLowerCase();
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function getUser(username) {
  if (!username) return null;
  const key = USER_PREFIX + username.trim().toLowerCase();
  const data = await kv.get(key);
  if (!data) return null;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch (e) { return null; }
  }
  if (typeof data === 'object') return data;
  return null;
}

async function kvSet(key, value) {
  // Guardar siempre como objeto directo (Upstash/vercel-kv lo serializa solo)
  await kv.set(key, value);
}

async function userExists(username) {
  return (await getUser(username)) !== null;
}

async function createUser({ username, password, securityQuestion, securityAnswer }) {
  const uname = String(username).trim().toLowerCase();
  if (!uname || !password || !securityQuestion || !securityAnswer) {
    throw new Error('Faltan campos obligatorios para crear el usuario.');
  }
  if (await userExists(uname)) {
    throw new Error('Ese nombre de usuario ya existe.');
  }

  const passwordSalt = makeSalt();
  const securityAnswerSalt = makeSalt();

  const record = {
    username: uname,
    passwordHash: hashWithSalt(password, passwordSalt),
    passwordSalt,
    securityQuestion: String(securityQuestion).trim(),
    securityAnswerHash: hashWithSalt(normalizeAnswer(securityAnswer), securityAnswerSalt),
    securityAnswerSalt,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await kvSet(USER_PREFIX + uname, record);
  await kv.sadd(USERS_INDEX_KEY, uname);
  return { username: uname };
}

async function verifyPassword(username, password) {
  const user = await getUser(username);
  if (!user) return false;
  const candidate = hashWithSalt(password, user.passwordSalt);
  return safeEqual(candidate, user.passwordHash);
}

async function getSecurityQuestion(username) {
  const user = await getUser(username);
  if (!user) return null;
  return user.securityQuestion;
}

async function verifySecurityAnswer(username, answer) {
  const user = await getUser(username);
  if (!user) return false;
  const candidate = hashWithSalt(normalizeAnswer(answer), user.securityAnswerSalt);
  return safeEqual(candidate, user.securityAnswerHash);
}

async function setPassword(username, newPassword) {
  const user = await getUser(username);
  if (!user) throw new Error('El usuario no existe.');
  const passwordSalt = makeSalt();
  user.passwordHash = hashWithSalt(newPassword, passwordSalt);
  user.passwordSalt = passwordSalt;
  user.updatedAt = Date.now();
  await kvSet(USER_PREFIX + user.username, user);
  return true;
}

async function setSecurityAnswer(username, securityQuestion, securityAnswer) {
  const user = await getUser(username);
  if (!user) throw new Error('El usuario no existe.');
  const securityAnswerSalt = makeSalt();
  user.securityQuestion = String(securityQuestion).trim();
  user.securityAnswerHash = hashWithSalt(normalizeAnswer(securityAnswer), securityAnswerSalt);
  user.securityAnswerSalt = securityAnswerSalt;
  user.updatedAt = Date.now();
  await kvSet(USER_PREFIX + user.username, user);
  return true;
}

async function listUsernames() {
  return (await kv.smembers(USERS_INDEX_KEY)) || [];
}

async function deleteUser(username) {
  const uname = String(username).trim().toLowerCase();
  await kv.del(USER_PREFIX + uname);
  await kv.srem(USERS_INDEX_KEY, uname);
  return true;
}

module.exports = {
  getUser,
  userExists,
  createUser,
  verifyPassword,
  getSecurityQuestion,
  verifySecurityAnswer,
  setPassword,
  setSecurityAnswer,
  listUsernames,
  deleteUser
};

