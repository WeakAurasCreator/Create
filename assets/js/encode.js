// ace serializer function from wowhead https://wow.zamimg.com/js/WeakAuraExport.js
 
 // EncodeForPrint forked from https://github.com/LetsTimeIt/mdt-compression under GPL-3.0 license
 // this version was fixed by Vardex
 
 // forked from WA companion
 
 const mappingTable = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "(",
    ")",
  ];
  
  const convertByteTo6bit = function (chr) {
    return mappingTable[chr].charCodeAt(0);
  };
  
  // EncodeForPrint encodes a buffer of bytes into an ASCII string that can be printed.
  // The string is encoded by converting each 6 bits into a printable ASCII character.
  const EncodeForPrint = function (input) {
      if (input.length === 0) {
          return "";
      }
  
      const strlen = input.length;
      const lenMinus2 = strlen - 2;
      let i = 0;
      let j = 0;
      const encodedChars = [];
  
      while (i < lenMinus2) {
          const x1 = input[i];
          const x2 = input[i + 1];
          const x3 = input[i + 2];
          i += 3;
          const cache = x1 + x2 * 256 + x3 * 65536;
          const b1 = cache % 64;
          const b2 = ((cache - b1) / 64) % 64;
          const b3 = ((cache - b1 - b2 * 64) / (64 * 64)) % 64;
          const b4 = ((cache - b1 - b2 * 64 - b3 * 64 * 64) / (64 * 64 * 64)) % 64;
  
          encodedChars.push(mappingTable[b1], mappingTable[b2], mappingTable[b3], mappingTable[b4]);
      }
      let cache = 0;
      let cache_bitlen = 0;
  
      while (i < strlen) {
          const x = input[i];
          cache += x * 2 ** cache_bitlen;
          cache_bitlen += 8;
          i += 1;
      }
  
      while (cache_bitlen > 0) {
          const bit6 = cache % 64;
          encodedChars.push(mappingTable[bit6]);
          cache = (cache - bit6) / 64;
          cache_bitlen -= 6;
      }
      return encodedChars.join('');
  };
  
  
  const deflate = function (input) {
      return pako.deflateRaw(input, { level: 9 });
  };
  
  const encode = function (input) {
      return EncodeForPrint(new Uint8Array(input));
  };
  
  const serializationMapping = [
      [/\^/g, "}"],
      [/~/g, "~|"],
      [/\s/g, "~`"],
  ];
  
  function replaceNonASCIICharacters(inputString) {
      // eslint-disable-next-line no-control-regex
      return inputString.replace(/[^\x00-\x7F]/g, "?");
  }
    
    function applySerializationMapping(inputString) {
      let result = inputString;
    
      for (const [search, replace] of serializationMapping) {
        result = result.replace(search, replace);
      }
    
      return result;
  }
    
  
  function serializeValue(value, serializedArray) {
  
    const valueType = typeof value;
  
    if (valueType === "string") {
      const processedValue = applySerializationMapping(
        replaceNonASCIICharacters(value),
      );
      serializedArray.push("^S", processedValue);
    } else if (valueType === "number") {
      serializedArray.push(`^N${value}`);
    } else if (valueType === "boolean") {
      serializedArray.push(value ? "^B" : "^b");
    } else if (valueType === "object" || Array.isArray(value)) {
      serializedArray.push("^T");
  
      for (const key of Object.keys(value)) {
        const parsedKey = /^\d+$/.test(key) ? Number.parseInt(key) : key;
        serializeValue(parsedKey, serializedArray);
        serializeValue(value[key], serializedArray);
      }
  
      serializedArray.push("^t");
    } else {
      console.error(`Cannot serialize a value of type "${valueType}"`);
    }
  }
  
  function serialize(input) {
      const serializedArray = ["^1"];
      serializeValue(input, serializedArray);
    return `${serializedArray.join("")}^^`;
  }
  
  function getRandomInt(min, max) {
      const range = max - min + 1;
      return Math.floor(Math.random() * range) + min;
  }
    
  function generateUniqueID() {
      const uid = new Array(11);
      const tableLen = mappingTable.length;
    
      for (let i = 0; i < 11; i++) {
        uid[i] = mappingTable[getRandomInt(0, tableLen - 1)];
      }
    
      return uid.join("");
  }