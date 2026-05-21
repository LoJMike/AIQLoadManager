'use strict';

function boolean(value) {
  if (value === true  || value === 1)    return true;
  if (value === false || value === 0)    return false;
  if (typeof value === 'string') {
    const v = value.toLowerCase().trim();
    if (v === 'true'  || v === '1' || v === 'yes' || v === 'on')  return true;
    if (v === 'false' || v === '0' || v === 'no'  || v === 'off') return false;
  }
  throw new boolean.BooleanError(`Invalid boolean value: ${value}`);
}

boolean.isBoolean = (v) => v === true || v === false;

boolean.BooleanError = class BooleanError extends Error {
  constructor(msg) { super(msg); this.name = 'BooleanError'; }
};

module.exports = boolean;
module.exports.default = boolean;
