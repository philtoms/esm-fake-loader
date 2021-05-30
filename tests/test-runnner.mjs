import { sut2 } from "./module?__fake=./module.mock.mjs";

console.log(sut2());
console.log(sut2.calls);
