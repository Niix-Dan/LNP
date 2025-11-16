import { encodeLNP, parseLNP } from '../index.js';

const obj = {
  user: { name: "Ana", age: 20, active: true },
  tags: ["dev","br"],
  data: null
};

const encoded = encodeLNP(obj);
console.log("Encoded bytes:", encoded);

const decoded = parseLNP(encoded);
console.log("Decoded object:", decoded);
