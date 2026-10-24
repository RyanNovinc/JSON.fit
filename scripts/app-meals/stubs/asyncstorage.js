// In-memory AsyncStorage (a real web build would back it with localStorage).
const m = new Map();
const S = {
  getItem: async (k) => (m.has(k) ? m.get(k) : null),
  setItem: async (k, v) => { m.set(k, String(v)); },
  removeItem: async (k) => { m.delete(k); },
  getAllKeys: async () => [...m.keys()],
  multiGet: async (ks) => ks.map((k) => [k, m.has(k) ? m.get(k) : null]),
  multiSet: async (kv) => kv.forEach(([k, v]) => m.set(k, v)),
  multiRemove: async (ks) => ks.forEach((k) => m.delete(k)),
  clear: async () => m.clear(),
};
module.exports = S; module.exports.default = S;
