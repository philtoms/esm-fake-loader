import fs from 'fs';

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
const inject = (fake) =>
  `const mock = (faked = (id) => id) => {
    const mocked = (...args) => {
      ++mocked.calls;
      mocked.values.push(args);
      return typeof faked==='function' ? faked(...args) : faked;
    }
    mocked.reset = () => {
      mocked.calls=0;
      mocked.values=[];
      return mocked;
    }
    return mocked.reset();
  }
  ${fake || 'export default mock()'}`;

export async function resolve(specifier, context, defaultResolve) {
  let { target, fakeType, fakeResponse = '' } = (
    specifier.match(
      /(?<target>[^?]+)\?(?<fakeType>__fake)(\=(?<fakeResponse>.+))?/
    ) || { groups: {} }
  ).groups;

  const { url } = defaultResolve(target || specifier, context, defaultResolve);

  if (fakeType) {
    // reload a module as is?
    if (fakeResponse === 'reload') {
      const fakeSignedUrl = `${url}?__fake${++fakeSequence}`;
      fakes[fakeSignedUrl] = fs.readFileSync(
        url.replace('file://', ''),
        'utf8'
      );

      return { url: fakeSignedUrl };
    }

    let fake =
      new URL('file://fake?' + fakeResponse).searchParams.get('fake') ||
      fakeResponse;

    // test for relative external fake
    try {
      const { url } = defaultResolve(fakeResponse, context, defaultResolve);
      fake = url.replace('file://', '');
    } catch (err) {}

    // strip out stale fakes
    fakes = Object.entries(fakes)
      .filter(([key]) => !key.startsWith(url))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    // done here, leave now
    if (fakeResponse === 'unload') return { url };

    // assign a unique signature to this fake.
    const fakeSignedUrl = `${url}?__fake${++fakeSequence}`;

    try {
      // apply, load and cache descriptor as faked module
      fakes[fakeSignedUrl] = inject(
        fake
          ? fs.existsSync(fake)
            ? fs.readFileSync(fake, 'utf8')
            : !fake.startsWith('export')
            ? `export default ${fake}`
            : fake
          : fake
      );
    } catch (err) {
      err.message = `${fake} - ${err.message}`;
      throw err;
    }

    return { url: fakeSignedUrl };
  } else {
    // substitute fake signed signature for fake map entry
    const { url } = defaultResolve(specifier, context);
    const fakeSignedUrl = Object.keys(fakes).find((key) => key.startsWith(url));
    if (fakeSignedUrl) {
      return { url: fakeSignedUrl };
    }
  }

  return { url };
}

export async function getFormat(url, context, defaultGetFormat) {
  // mocked builtins become modules
  if (fakes[url]) {
    return {
      format: 'module',
    };
  }
  //Defer to Node.js for all other URLs.
  return defaultGetFormat(url, context, defaultGetFormat);
}

export async function getSource(url, context, defaultGetSource) {
  // substitute fake source if available
  if (fakes[url]) {
    return { source: fakes[url] };
  }
  // Defer to Node.js for all other URLs.
  return defaultGetSource(url, context, defaultGetSource);
}
