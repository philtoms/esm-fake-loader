import fs from "fs";
import path from "path";

let fakes = {};
let fakeSequence = 0;

// inject (a mock facility).
//  ?__fake=export default mock(123)
//  ?__fake=export const _method = mock(fn)
//  ?__fake=export const _method = value => mock(value)
//
// or use a fake module for more complicated scenarios
//  ?__fake=./mock.js
//  ./mock.js
//    export default mock(123)
//    export const mock(args=>args)
//
//  import mocked from 'module'
//  mocked(123)
//  assert(mocked.calls === 1)
//  assert(mocked.values[0][0], 123)
//  mocked.reset(returns)
const inject = (fake) =>
  `const mock = (faked = (id) => id) => {
    const mocked = (...args) => {
      ++mocked.calls;
      mocked.values.push(args);
      const returns = mocked.returns === undefined ? args : [mocked.returns]
      return typeof faked==='function'
        ? faked(...returns)
        : mocked.returns === undefined
          ? faked
          : mocked.returns;
    }
    mocked.reset = (returns) => {
      mocked.returns = returns
      mocked.calls=0;
      mocked.values=[];
      return mocked;
    }
    return mocked.reset();
  }
  ${fake || "export default mock()"}`;

export async function resolve(specifier, context, defaultResolve) {
  let {
    target = specifier,
    fakeType,
    fakeResponse = "",
  } = (
    specifier.match(
      /(?<target>[^?]+)[\?\&](?<fakeType>__fake)(\=(?<fakeResponse>.+))?/
    ) || { groups: {} }
  ).groups;

  // this may be a virtual module
  let url;
  try {
    url = defaultResolve(target, context, defaultResolve).url;
  } catch (err) {
    url = `file://${target.split("?")[0]}`;
    if (!fakeType && !fakes[url]) {
      try {
        url = defaultResolve(
          `file://${path.join(process.cwd(), target)}`,
          context,
          defaultResolve
        ).url;
      } catch (err) {
        throw err;
      }
    }
  }

  if (fakeType) {
    if (fakeResponse === "unload") {
      Reflect.deleteProperty(fakes, url);
      return { url };
    }

    // reload a module as is?
    if (fakeResponse === "reload") {
      fakes[url] = {
        source: fs.readFileSync(url.replace("file://", ""), "utf8"),
        signedUrl: `${url}?__fake${++fakeSequence}`,
      };

      return { url: fakes[url].signedUrl };
    }

    let fake =
      new URL("file://__fake?" + fakeResponse).searchParams.get("__fake") ||
      fakeResponse;

    // test for relative external fake
    try {
      const { url } = defaultResolve(fakeResponse, context, defaultResolve);
      fake = url.replace("file://", "");
    } catch (err) {}

    try {
      // apply, load and cache descriptor as faked module
      const source = inject(
        fake
          ? fs.existsSync(fake)
            ? fs.readFileSync(fake, "utf8")
            : !fake.startsWith("export")
            ? `export default ${fake}`
            : fake
          : fake
      );

      // don't try to re-use previously loaded modules by testing for
      // sameness of source. If the fake is already then its dependencies
      // are loaded too. Not good for nested fakes. There is a test for it
      const signedUrl = /*        fakes[url] && fakes[url].source === source
          ? fakes[url].signedUrl
          : */ `${url}?__fake${++fakeSequence}`;

      fakes[url] = { source, signedUrl };

      return { url: signedUrl };
    } catch (err) {
      err.message = `${fake} - ${err.message}`;
      throw err;
    }
  } else {
    // substitute fake signed signature for fake map entry
    if (fakes[url]) {
      return { url: fakes[url].signedUrl };
    }
  }

  return { url };
}

export async function getFormat(url, context, defaultGetFormat) {
  // mocked builtins become modules
  const key = url.split("?__fake")[0];
  if (fakes[key]) {
    return {
      format: "module",
    };
  }
  //Defer to Node.js for all other URLs.
  return defaultGetFormat(url, context, defaultGetFormat);
}

export async function getSource(url, context, defaultGetSource) {
  // substitute fake source if available
  const key = url.split("?__fake")[0];
  if (fakes[key]) {
    return { source: fakes[key].source };
  }
  // Defer to Node.js for all other URLs.
  return defaultGetSource(url, context, defaultGetSource);
}
