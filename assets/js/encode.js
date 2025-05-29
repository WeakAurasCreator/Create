import pako from "pako";

/** ─────────────────────────────────────────────── **
 *  64-char table for chat‐safe 6-bit encoding      *
 ** ─────────────────────────────────────────────── **/
const MAPPING = [
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
  "(",
  ")"
];

/** 6-bit encoder (LibDeflate:EncodeForPrint) */
function encodeForPrint(bytes) {
  let out = [], acc = 0, bits = 0;
  for (const b of bytes) {
    acc |= b << bits;
    bits += 8;
    while (bits >= 6) {
      out.push( MAPPING[acc & 0x3F] );
      acc >>>= 6;
      bits -= 6;
    }
  }
  if (bits > 0) out.push( MAPPING[acc & 0x3F] );
  return out.join("");
}

/** raw DEFLATE (LibDeflate:CompressDeflate) */
function compressRaw(dataStr) {
  const utf8 = new TextEncoder().encode(dataStr);
  return pako.deflateRaw(utf8, { level: 9 });
}

/** ─────────────────────────────────────────────── **
 *  LibSerialize:SerializeEx (JS port, default config)  
 ** ─────────────────────────────────────────────── **/
// libserialize-port.js

/**
 * A JS port of LibSerialize:SerializeEx from
 * https://github.dev/rossnichols/LibSerialize/blob/main/LibSerialize.lua
 *
 * Supports only the default configForLS = { errorOnUnserializableType = false }
 * which WA uses, so it will skip any unserializable types instead of blowing up.
 */

const TYPE_STRING  = "^S";
const TYPE_NUMBER  = "^N";
const TYPE_TRUE    = "^B";
const TYPE_FALSE   = "^b";
const TYPE_TABLE   = "^T";
const TYPE_TABLE_END = "^t";

/**
 * escape rules exactly as in LibSerialize:
 * 1) non-ASCII → "?"
 * 2) "^" → "}"
 * 3) "~" → "~|"
 * 4) whitespace → "~`"
 */
const ESCAPE_RULES = [
  [/[^\x00-\x7F]/g,   "?"],
  [/\^/g,             "}"],
  [/~/g,               "~|"],
  [/\s/g,              "~`"]
];

function escapeString(str) {
  for (const [pat, rep] of ESCAPE_RULES) {
    str = str.replace(pat, rep);
  }
  return str;
}

/**
 * Recursively serializes a JS value following the Lua logic:
 * - primitive types: string, number, boolean
 * - objects/arrays: into two-part tables (array part then hash part, sorted keys)
 * - skips undefined/null
 * 
 * config.errorOnUnserializableType=false: silently omit bad types.
 */
function serializeValue(val, out, config) {
  const t = typeof val;
  if (t === "string") {
    out.push(TYPE_STRING, escapeString(val));
  }
  else if (t === "number") {
    out.push(TYPE_NUMBER, String(val));
  }
  else if (t === "boolean") {
    out.push(val ? TYPE_TRUE : TYPE_FALSE);
  }
  else if (val == null) {
    // skip null/undefined
    return;
  }
  else if (t === "object") {
    // begin table
    out.push(TYPE_TABLE);

    const isArray = Array.isArray(val);

    // 1) array part 1..n
    if (isArray) {
      for (let i = 0; i < val.length; i++) {
        serializeValue(i + 1, out, config);
        serializeValue(val[i], out, config);
      }
    }

    // 2) hash part: keys not in 1..n, sorted
    const keys = Object.keys(val)
      .filter(k => !(isArray && /^\d+$/.test(k) && +k >= 1 && +k <= val.length))
      .sort((a, b) => {
        // numeric keys before string, numeric sorted numerically
        const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
        if (na && nb) return +a - +b;
        if (na) return -1;
        if (nb) return 1;
        return a < b ? -1 : a > b ? 1 : 0;
      });

    for (const k of keys) {
      const coercedKey = /^\d+$/.test(k) ? Number(k) : k;
      serializeValue(coercedKey, out, config);
      serializeValue(val[k], out, config);
    }

    // end table
    out.push(TYPE_TABLE_END);
  }
  else {
    // function, symbol, BigInt, etc.
    if (config.errorOnUnserializableType) {
      throw new Error(`Cannot serialize type ${t}`);
    }
    // else skip it
  }
}

/**
 * serializeEx(config, inTable) → string
 *   config: { errorOnUnserializableType: boolean }
 *   inTable: any JS object/array
 *
 * Returns the full "^1 … ^^" payload.
 */
export function serializeEx(inTable, config) {
  // default config:
  config = config || { errorOnUnserializableType: true };

  const out = ["^1"];
  serializeValue(inTable, out, config);
  out.push("^^");
  return out.join("");
}

/** ─────────────────────────────────────────────── **
 *  Wago’s fixNumericIndexes & fixWATables in JS  
 ** ─────────────────────────────────────────────── **/
function fixNumericIndexes(tbl) {
  const fixed = {};
  for (const [k,v] of Object.entries(tbl)) {
    const n = Number(k);
    if (!isNaN(n) && n > 0) fixed[n] = v;
    else                  fixed[k] = v;
  }
  return fixed;
}

function fixWATables(obj) {
  if (obj.triggers) {
    obj.triggers = fixNumericIndexes(obj.triggers);
    for (const t of Object.values(obj.triggers)) {
      const trg = t.trigger;
      if (trg?.form?.multi)      trg.form.multi      = fixNumericIndexes(trg.form.multi);
      if (trg?.talent?.multi)    trg.talent.multi    = fixNumericIndexes(trg.talent.multi);
      if (trg?.specId?.multi)    trg.specId.multi    = fixNumericIndexes(trg.specId.multi);
      if (trg?.herotalent?.multi)trg.herotalent.multi= fixNumericIndexes(trg.herotalent.multi);
      if (trg?.actualSpec)       trg.actualSpec      = fixNumericIndexes(trg.actualSpec);
      if (trg?.arena_spec)       trg.arena_spec      = fixNumericIndexes(trg.arena_spec);
    }
  }
  if (obj.load) {
    for (const key of ["talent","talent2","talent3","herotalent","class_and_spec"]) {
      if (obj.load[key]?.multi) {
        obj.load[key].multi = fixNumericIndexes(obj.load[key].multi);
      }
    }
  }
  return obj;
}

/** ─────────────────────────────────────────────── **
 *  Main export: turns a JS object → "!WA:2!…" string  
 ** ─────────────────────────────────────────────── **/
export function encode(full, forChat = true) {
  // 1) Wago’s table‐fixes on the `.d` (and `.c`) part
  if (!full || typeof full !== "object" || !full.d) {
    throw new Error("Invalid WA JSON");
  }
  const t = JSON.parse(JSON.stringify(full)); // shallow clone
  t.d = fixWATables(t.d);
  if (Array.isArray(t.c)) {
    t.c = t.c.map(c => c ? fixWATables(c) : c);
  }

  // 2) serialize + compress + encode
  const serialized = serializeEx(t);
  const deflated   = compressRaw(serialized);
  const body       = encodeForPrint(deflated);

  // 3) prefix bump from WA1→WA2
  return `!WA:1!${body}`;
}
