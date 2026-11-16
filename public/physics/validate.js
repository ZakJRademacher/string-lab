// validate.js: a tiny rule checker shared by the browser AND the server.
//
// Lesson: never trust input. Data from a web form, a saved file or an AI model can
// be wrong (or malicious). Every module describes its allowed values as a "spec",
// and checkFields() returns either a clean copy of the values or a list of errors.
//
// Lesson 2: data outlives code. Saves made last week don't have settings added
// this week. A rule can carry a `fallback` value that fills in a MISSING field,
// so old saves keep loading. (A field that is present but wrong is still an error.)

export const int = (min, max, fallback) => ({ type: 'int', min, max, fallback });
export const num = (min, max, fallback) => ({ type: 'num', min, max, fallback });
export const oneOf = (values, fallback) => ({ type: 'enum', values, fallback });
/** A short text value that must match a pattern, e.g. a list like "XW,YZ". */
export const pattern = (re, describe, fallback) => ({ type: 'pattern', re, describe, fallback });

export function checkFields(input, spec, path = '') {
  const where = (key) => (path ? `${path}.${key}` : key);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: [`${path || 'value'} must be an object`] };
  }
  const errors = [];
  const value = {};
  for (const [key, rule] of Object.entries(spec)) {
    let v = input[key];
    if (v === undefined && rule.fallback !== undefined) v = rule.fallback;
    if (rule.type === 'pattern') {
      if (typeof v !== 'string' || v.length > 200 || !rule.re.test(v)) errors.push(`${where(key)} must be ${rule.describe}`);
      else value[key] = v;
      continue;
    }
    if (rule.type === 'enum') {
      if (!rule.values.includes(v)) errors.push(`${where(key)} must be one of: ${rule.values.join(', ')}`);
      else value[key] = v;
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push(`${where(key)} must be a number`);
    } else if (rule.type === 'int' && !Number.isInteger(v)) {
      errors.push(`${where(key)} must be a whole number`);
    } else if (v < rule.min || v > rule.max) {
      errors.push(`${where(key)} must be between ${rule.min} and ${+rule.max.toFixed(4)}`);
    } else {
      value[key] = v;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
