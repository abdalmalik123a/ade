/** الجسر وحده بين النافذة والعملية الرئيسة — والمفتاح الخاص لا يعبره أبدًا. */
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('keytool', {
  state: call('state'),
  createPassword: call('create-password'),
  unlock: call('unlock'),
  lock: call('lock'),
  previewUntil: call('preview-until'),
  normalizeDevice: call('normalize-device'),
  issue: call('issue'),
  ledger: call('ledger'),
  copy: call('copy'),
  pickInstaller: call('pick-installer'),
  makeUpdate: call('make-update'),
  showFile: call('show-file'),
  changePassword: call('change-password'),
  openFolder: call('open-folder'),
  onLocked: (fn) => ipcRenderer.on('locked', () => fn())
});
