module.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : () => undefined) });
