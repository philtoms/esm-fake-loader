# esm-fake-loader

For testing Javascript applications running as `"type": "module"` or `.mjs`, this esm-loader provides extended import syntax for mocking and stubbing built-in, package and module imports.

## Install

```
yarn add esm-fake-loader --dev
npm install -save-dev esm-fake-loader
```

## Usage

```
// test.js
import 'fs?__fake=export const readFileSync = () => "some fake contents..."'


// app.js
import { readFileSync } from 'fs'
readFileSync('./path', 'utf8') // => "some fake contents..."


// run tests in loader context...
node --loader esm-fake-loader ./path/to/test/runner

```

## How it works

The loader is installed through the node command line and filters all import specifiers ending in `?__fake=...` descriptor strings. The additional information in these extended requests is used to stub or mock the specified module. The descriptor can either be a file path to a fake module, or an inline mock or stub.

```javascript
// package.json (for convenience)
"scripts": {
  "test": "node --loader esm-fake-loader ./node_modules/.bin/ava"
}

// sut.js
import fs from 'fs'
export default path => fs.existSync(path) ? 'something' : 'something else'

// test.js
import test from 'ava'
import sut from './sut.js'

// set up a faked stub
import 'fs?__fake=export const existSync = () => true'

test('should return something', t => {
  t.is(sut('./path'), 'something')
})

// alternate fake scenario
test.serial('should return something else', async t => {
  await import('fs?__fake=export const existSync = () => false')
  t.is(sut('./path'), 'something else')
})
```

## Fake descriptor syntax

`esm-fake-loader` supports inline fakes and external fake modules, both defined as extended specifiers of the form `specifier?__fake=descriptor`

### Using inline fake descriptors - stubs

By default, `esm-fake-loader` applies stubs and will always supply the value described through the descriptor.

Stubbing a default export value</br>
`const faked = import 'module?__fake=123'`

Stubbing a default export function</br>
`const faked = import 'module?__fake=() => 123'`

Stubbing a default scenario export function</br>
`const faked = import 'module?__fake=(cond) => cond ? "OK" : "NOT OK"`

Stubbing a named export value</br>
`const {named} = import 'module?__fake=export const named = 123'`

Stubbing a named export function</br>
`const {named} = import 'module?__fake=export const named = () => 123'`

Stubbing a named scenario export function</br>
`const {named} = import 'module?__fake=export const named = (cond) => cond ? "OK" : "NOT OK"'`

### Using inline fake descriptors - mocks

Mocks must be explicitly declared by wrapping the stub value or function with a mock - as in `?__fake=mock(123)`. Note that mocks are functions, so mocking a stubbed value is shorthand for mocking a function export.

Mocking a default export function - shorthand</br>
`const faked = import 'module?__fake=mock(123)'`

Mocking a default export function</br>
`const faked = import 'module?__fake=mock(() => 123)'`

Mocking a default scenario export function</br>
`const faked = import 'module?__fake=mock((cond) => cond ? "OK" : "NOT OK")`

Mocking a named export value - shorthand</br>
`const {named} = import 'module?__fake=export const named = mock(123)'`

Mocking a named export function</br>
`const {named} = import 'module?__fake=export const named = mock(() => 123)'`

Mocking a named scenario export function</br>
`const {named} = import 'module?__fake=export const named = mock((cond) => cond ? "OK" : "NOT OK")'`

The mock wrapper function patches the fake with the following properties:

- `calls` - the number of calls recorded since the last reset
- `values` - the vales received by the mock since the last reset
- `reset()` - a helper to clear the calls and values of a mock.

```javascript
import mod from "module.js?__fake=mock(true)";

test("mod test", (t) => {
  t.true(mod(111));
  t.true(mod(222));
  t.is(mod.calls, 2);
  t.deepEqual(mod.values, [[111], [222]]);
});
```

### Mixing mocks and stubs in inline fake descriptors

Inline fakes must be valid javascript but `esm-fake-loader` does allow a couple of shortcuts that favor succinct and targeted fakes. The following descriptor pairs share the same behavior:

`import 'module?__fake'`</br>
`import 'module?__fake=export default id => id'`</br>

`import 'module?__fake=mock(123)'`</br>
`import 'module?__fake=export default mock(()=>123)'`</br>

However, so long as the descriptor is valid javascript there is no hard restriction on the size and complexity of the fake. For example, it's ok to export more than one fake from the same descriptor.

`const faked1, {faked2} = import 'module?__fake=export default mock(123); export const faked2 = 456'`

Nevertheless it is usually a good idea to apply an externally defined fake module to more complex scenarios.

### Using external fakes

External fakes are standard esm modules and adhere to the rules and conventions governing esm module development.

`esm-fake-loader` recognizes external fakes as valid file paths. Standard specifier resolution applies to the file path so, for example, a fake co-located with a test would be referenced as `?__fake=./my-fake.js`. Absolute paths and packages are also directly supported.

`?__fake=./my-co-located-fake.js`<br>
`?__fake=../../my-fakes/fake.js`<br>
`?__fake=/path/to/my-fake.js`<br>
`?__fake=my-fake-package`<br>

The main advantage of external fake modules over inline fakes is their extended influence over the faked module when defining mocks, stubs and even spies.

### Create multiple fake exports using stubs and mocks.

```javascript
// test.js
import { existsSync, readFileSync } from "fs?__fake=./fs.fakes.js";

// fs.fake.js
export const existSync = () => true;
export const readFileSync = mock(() => true);
```

External fakes are also the way to go when faking out a sub-set of a module's functionality...

```javascript
// test.js
import mod, { func2, func3, func4 } from "mod.js?__fake=./mod.fakes.js";

// mod.fakes.js
// bypass the faked version of this module by unloading the fake here
import mod, { func1, func2, func3 } from "mod.js?__fake=unload";

// spy on default export...
export default mock((...args) => func1(...args));

// stub func1...
export const func1 = () => true;

// mock func2...
export const func2 = mock(() => true);

// pass unfaked func3...
export { func3 };
```

### Reloading modules

Modules under test can be reloaded at any time in the test cycle with the explicit `?__fake=reload` descriptor.

```javascript
// sut.js
export default 'abc';

// test.js
import sut from 'sut?__fake=123'

test('should be faked', async t => {
  t.is(sut, 123)
})

test('should be reloaded and un-faked', async t => {
  const sut = await import 'sut?__fake=reload'
  t.is(sut, 'abc')
})
```

This pattern is most useful in test scenarios with varying fake response requirements.

### Resetting mocks

Mocks will continue to accumulate calls and call values from the first to the last test (see [Fake module scope and lifetime](#lifetime)).

Mocks can be reset at any time in the test cycle by calling `mocked.reset()`.

```javascript
import sut from "sut?__fake=mock(123)";

test("should accumulate calls", async (t) => {
  sut();
  t.is(sut.calls, 1);
});

test("should reset calls", async (t) => {
  sut.reset();
  t.is(sut.calls, 0);
});
```

### Virtual fakes

If a specifier does not resolve to a file based module or package, then a virtual fake is created. This has the same behavior and specification as any other fake, but of course it's not strictly a fake because these is no underlying implementation.

`import virtual from 'virtual?__fake=mock()'`

Virtual fakes are useful for creating and passing around mocks and spies. For example, the following API under test expects a logging facility to be provided, otherwise it defaults to `console.log`.

```javascript
const handlerMW = errorHandler({ log }); // accepts winston, defaults to console
```

You could quite easily fake `console?__fake={log: mock()}`, but what if you want to use console for other debugging tasks?

Just create a virtual fake:

```javascript
import log from "fake-logger?__fake={log: mock()}";

const handlerMW = errorHandler({ log }); // accepts mocked logger
```

## Caveats and considerations

### Experimental loader status

Whilst esm is officially supported in nodeJS, the ability to override the default esm loader functionality is currently behind an [experimental flag](https://nodejs.org/api/esm.html#esm_experimental_loaders).

`node --experimental-loader esm-fake-loader ./node_modules/.bin/ava`

### Loader overloading

Given that your project is fully ESM, its possible that you already have need for custom loader logic. Use a loader wrapper module to pre-load `esm-fake-loader` over your `custom-loader`.

`node --experimental-loader ./wrapper-loader ./node_modules/.bin/ava`

```javascript
// wrapper-loader.js

// overload all custom named exports. In this example, only the resolve export has been customized. All other loader steps will be handled by esm-fake-loader.

import { resolve as fakeResolve } from "esm-fake-loader";
import { resolve as customResole } from "./custom-loader";

export async function resolve(specifier, context, defaultResolve) {
  const resolved = fakeResolve(specifier, context, defaultResolve);
  // test for fake status
  return resolved.url.includes("?__fake")
    ? resolved
    : customResole(specifier, context, defaultResolve);
}
```

<a id='lifetime'></a>

### Fake module scope and lifetime.

`esm-fake-loader` fakes rely on the underlying [ECMAScript Modules](https://nodejs.org/api/esm.html) implementation. This means that once loaded as a singleton module, subsequent imports will recycle the same module instance. This is the desired behavior of course, but it does rely on the underlying test runner / framework architecture.

The [ava](https://github.com/avajs/ava) test runner (`esm-fake-loader` was developed primarily for ava integration) provides an [Isolated environment for each test file](https://github.com/avajs/ava/blob/master/docs/01-writing-tests.md#process-isolation) which boils down to a dedicated node instance for each test file - thus loaded module instances are reliably recycled on a test file basis.

However, it can be appropriate to re-purpose a fake during the test cycle. To do this, apply the fake descriptor `__fake=reload` to the module under test so that it is reloaded with the new fake import.

A useful pattern for this kind of test cycle is a fake factory:

```javascript
// sut.js
import { existsSync } from 'fs';
export default (path) => existsSync(path);

// test.js
const fake = (exp) =>
  // generate a new fake response
  const response = 'export const existsSync = response => response';
  import(`fs?__fake=${response}==='${exp}'`)
    // then reload the sut to apply the fake
    .then(() => import('./sut?__fake=reload'))
    .then((module) => module.default);

test.serial('first', async (t) => {
  const sut = await fake('/path/to/first');
  t.is(sut('/path/to/first'), true);
});

test.serial('second', async (t) => {
  const sut = await fake('/path/to/second');
  t.is(sut('/path/to/second'), true);
});
```

### Concurrent test environments

Test frameworks like `ava` run tests concurrently, and this can be a problem for dynamically loaded modules where independent tests might fake different aspects of the same module. The following `ava` test suite is indeterminate and likely to fail.

```javascript
test("1", async (t) => {
  // might return 222
  await import("module?__fake=111");
});
test("2", async (t) => {
  // might return 111
  await import("module?__fake=222");
});
```

It is therefore recommended to run dynamic tests serially to avoid potential concurrency issues.

```javascript
test.serial("1", async (t) => {
  // guaranteed to return 111
  await import("module?__fake=111");
});
test.serial("2", async (t) => {
  // guaranteed to return 222
  await import("module?__fake=222");
});
```

### Modules loaded in external virtual fakes

As described in [Using external fakes](#Using-external-fakes), it is often convenient to import additional module resources in the fake module. But there is a gotcha when the importing fake module is itself a virtual module or unmounted module reference) and the imported module is selected through a relative path.

```javascript
// inside fakes.js....
import mod from "./mod.js"; // this will fail with ERR_INVALID_FILE_URL_HOST
```

Use a root filepath when importing local modules into a virtual fake

```javascript
// inside fakes.js....
import mod1 from "/root/path/to/mod.js"; // this will resolve
```
