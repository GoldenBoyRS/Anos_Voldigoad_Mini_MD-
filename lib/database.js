// lib/database.js — adaptateur local, remplace MongoDB
const fs = require('fs-extra');
const path = require('path');
const { atomicWriteJSON, readJSON } = require('../src/utils/files');
const config = require('../config');
const sessionsDir = path.resolve(config.SESSIONS_DIR || './sessions');
const defaults = {
  AUTO_RECORDING:'false', AUTO_TYPING:'false', ANTI_CALL:'false',
  REJECT_MSG:'*🔕 Your call was automatically rejected.*', READ_MESSAGE:'false',
  AUTO_VIEW_STATUS:'true', AUTO_LIKE_STATUS:'true', AUTO_STATUS_REPLY:'false',
  AUTO_STATUS_MSG:'🤗', AUTO_LIKE_EMOJI:['❤️','👍','😮','😎'],
  ANTIDELETE:'true'
};
const clean = n => String(n||'').replace(/\D/g,'');
const statePath = n => path.join(sessionsDir, clean(n), 'state.json');

async function connectdb(){ return true; }
async function getUserConfigFromMongoDB(n) {
  const state = await readJSON(statePath(n), {});
  return { ...defaults, ...(state.userConfig || {}) };
}
async function updateUserConfigInMongoDB(n, patch) {
  const number = clean(n);
  const file = statePath(number);
  const state = await readJSON(file, { version:1, number, userConfig:{} });
  state.userConfig = { ...defaults, ...(state.userConfig||{}), ...(patch||{}) };
  state.updatedAt = new Date().toISOString();
  await fs.ensureDir(path.dirname(file));
  await atomicWriteJSON(file, state);
  return state.userConfig;
}
const updateUserConfig = updateUserConfigInMongoDB;
async function incrementStats(n, key, amount=1) {
  const file = path.join(sessionsDir, clean(n), 'stats.json');
  const s = await readJSON(file, { messagesReceived:0, messagesSent:0, commandsUsed:0, groupsInteracted:0, reconnects:0 });
  s[key] = (Number(s[key])||0) + (Number(amount)||0);
  s.updatedAt = new Date().toISOString();
  await fs.ensureDir(path.dirname(file));
  await atomicWriteJSON(file, s);
  return s;
}
async function getStatsForNumber(n) {
  return readJSON(path.join(sessionsDir, clean(n), 'stats.json'),
    { messagesReceived:0, messagesSent:0, commandsUsed:0, groupsInteracted:0, reconnects:0 });
}
async function addNumberToMongoDB(){ return true; }
async function removeNumberFromMongoDB(){ return true; }
async function getAllNumbersFromMongoDB() {
  const items = await fs.readdir(sessionsDir, { withFileTypes: true }).catch(()=>[]);
  return items.filter(x => x.isDirectory() && /^\d+$/.test(x.name)).map(x => x.name);
}
async function saveOTPToMongoDB(n, otp, cfg) {
  const f = path.join(sessionsDir, clean(n), 'otp.json');
  await atomicWriteJSON(f, { otp, config: cfg, expiresAt: Date.now() + 300000 });
}
async function verifyOTPFromMongoDB(n, otp) {
  const f = path.join(sessionsDir, clean(n), 'otp.json');
  const d = await readJSON(f, null);
  if (!d || d.otp !== String(otp) || Date.now() > d.expiresAt) return { valid:false, error:'Invalid or expired OTP' };
  await fs.remove(f);
  return { valid:true, config: d.config };
}
module.exports = {
  connectdb, getUserConfigFromMongoDB, updateUserConfigInMongoDB, updateUserConfig,
  incrementStats, getStatsForNumber, saveOTPToMongoDB, verifyOTPFromMongoDB,
  addNumberToMongoDB, removeNumberFromMongoDB, getAllNumbersFromMongoDB,
};
