import test from "ava";
import sut from "./module?__fake";

test("inline default (identity) function stub", async (t) => {
  t.is(sut(456), 456);
});

test.serial("inline default value stub", async (t) => {
  const { default: sut } = await import("./module?__fake=456");
  t.is(sut, 456);
});

test.serial("inline exported value stub", async (t) => {
  const { val: sut } = await import("./module?__fake=export const val = 456");
  t.is(sut, 456);
});

test.serial("inline multiple exports", async (t) => {
  const {
    default: sut1,
    sut2,
    sut3,
  } = await import(
    "./module?__fake=export default 456; export const sut2 = 456; export const sut3 = 456"
  );
  t.is(sut1, 456);
  t.is(sut2, 456);
  t.is(sut3, 456);
});

test.serial("mocked default exports - shorthand", async (t) => {
  const { default: sut } = await import("./module?__fake=mock(456)");
  t.is(sut(456), 456);
  t.is(sut.calls, 1);
  t.deepEqual(sut.values, [[456]]);
});

test.serial("mocked default exports", async (t) => {
  const { default: sut } = await import("./module?__fake=mock(()=>456)");
  t.is(sut(456), 456);
  t.is(sut.calls, 1);
  t.deepEqual(sut.values, [[456]]);
});

test.serial("mocked named exports", async (t) => {
  const { sut } = await import(
    "./module?__fake=export const sut = mock(()=>456)"
  );
  t.is(sut(456), 456);
  t.is(sut.calls, 1);
  t.deepEqual(sut.values, [[456]]);
});

test.serial("mocked named exports - shorthand", async (t) => {
  const { sut } = await import("./module?__fake=export const sut = mock(456)");
  t.is(sut(456), 456);
  t.is(sut.calls, 1);
  t.deepEqual(sut.values, [[456]]);
});

test.serial("external fake file", async (t) => {
  const {
    default: sutD,
    sut1,
    sut2,
    sut3,
  } = await import("./module?__fake=./module.mock.mjs");
  t.is(sutD(456), 456);
  t.is(sutD.calls, 1);
  t.is(sut1(456), 123);
  t.is(sut2(123), 456);
  t.deepEqual(sut2.values, [[123]]);
  t.is(sut3, 456);
});

test.serial("nested external fake file", async (t) => {
  await import("./module1?__fake");
  const { sut1 } = await import("./module?__fake=./module.mock.mjs");
  t.is(sut1(456), 456);
});

test.serial("parse error in fake source", async (t) => {
  const error = await t.throwsAsync(() =>
    import("./module?__fake=i_dont_exist")
  );
  t.is(error.message, "i_dont_exist is not defined");
});

test.serial("builtin method stub", async (t) => {
  const fs = await import("fs?__fake=export const existsSync = () => true");
  t.true(fs.existsSync());
});

test.serial("builtin method mock", async (t) => {
  const fs = await import(
    "fs?__fake=export const existsSync = mock(id => true)"
  );
  fs.existsSync.reset();
  fs.existsSync("./dir");
  fs.existsSync("./dir");
  t.is(fs.existsSync.calls, 2);
});

test.serial("builtin method mock reset", async (t) => {
  const fs = await import(
    "fs?__fake=export const existsSync = mock(id => true)"
  );
  fs.existsSync.reset();
  fs.existsSync("./dir");
  t.is(fs.existsSync.calls, 1);
});

test.serial("reset mocked function returns", async (t) => {
  const fs = await import("fs?__fake=export const existsSync = mock(true)");
  t.is(fs.existsSync("./dir"), true);
  fs.existsSync.reset(false);
  t.is(fs.existsSync("./dir"), false);
});

test.serial("unload faked", async (t) => {
  await import("./module?__fake=unload");
  const { default: sut } = await import("./module.mjs");
  t.is(sut(456), 123);
});

test.serial("overload un-faked", async (t) => {
  await import("./module?__fake");
  const { default: sut } = await import("./module.mjs");
  t.is(sut(456), 456);
});

test.serial("reload sut", async (t) => {
  const { default: sut } = await import("./module?__fake=reload");
  t.is(sut(456), 123);
});

test.serial("virtual module", async (t) => {
  const { default: sut } = await import("virtual?__fake=mock(123)");
  t.is(sut(456), 123);
});
