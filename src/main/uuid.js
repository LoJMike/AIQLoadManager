/**
 * uuid.js — uses Node's built-in crypto.randomUUID()
 * Available since Node 16. No npm package needed.
 */
const { randomUUID } = require('crypto');
module.exports = { v4: randomUUID };
