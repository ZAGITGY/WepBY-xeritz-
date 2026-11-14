// Run: node minecraft-addon/tools/test/run.mjs
// Loads the real TreeVein_BP/scripts/main.js against a mock @minecraft/server.
import { register } from "node:module";
import assert from "node:assert/strict";

register("./resolve-hook.mjs", import.meta.url);

const M = await import("./mock-server.mjs");
await import("../../packs/TreeVein_BP/scripts/main.js");
const { FakeDimension, FakePlayer, ItemStack, GameMode, breakAs, spawnAs } = M;

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

function oakTree(dim, x0 = 0, height = 6, { persistent = false } = {}) {
  for (let y = 0; y < height; y++) dim.set(x0, y, 0, "oak_log");
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      for (let y = height - 2; y <= height; y++)
        if ((dx || dz || y === height) && dim.typeAt(x0 + dx, y, dz) === "minecraft:air")
          dim.set(x0 + dx, y, dz, "oak_leaves", { persistent_bit: persistent });
}
const total = (dim, id) => dim.spawned.filter((s) => s.typeId === id).reduce((a, s) => a + s.amount, 0);

test("sneak + axe fells the whole tree, drops one pile at the stump", () => {
  const dim = new FakeDimension();
  oakTree(dim);
  dim.set(0, -1, 0, "oak_log"); // a log under the stump must be left alone
  const p = new FakePlayer();
  const axe = ItemStack.tool("iron_axe", { max: 250 });
  breakAs(p, dim, 0, 0, 0, axe);
  assert.equal(dim.count("oak_log"), 1, "only the log below the stump should remain");
  assert.equal(dim.typeAt(0, -1, 0), "minecraft:oak_log");
  assert.equal(total(dim, "minecraft:oak_log"), 5);
  assert.ok(dim.spawned.every((s) => s.at.x === 0.5 && s.at.y === 0.5 && s.at.z === 0.5));
  assert.equal(axe.getComponent("minecraft:durability").damage, 5, "no Unbreaking: 1 damage per extra log");
  assert.equal(p.mainhand, axe);
  assert.match(p.actionbar, /\+6 logs/);
  assert.ok(dim.count("oak_leaves") > 0, "leaves are left to decay naturally");
});

test("not sneaking: vanilla behaviour only", () => {
  const dim = new FakeDimension();
  oakTree(dim);
  breakAs(new FakePlayer({ sneaking: false }), dim, 0, 0, 0, ItemStack.tool("iron_axe"));
  assert.equal(dim.count("oak_log"), 5);
});

test("log cabin (no leaves) is not chopped", () => {
  const dim = new FakeDimension();
  for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) dim.set(x, y, 0, "spruce_log");
  breakAs(new FakePlayer(), dim, 0, 0, 0, ItemStack.tool("iron_axe"));
  assert.equal(dim.count("spruce_log"), 23);
});

test("logs touching only player-placed leaves are not chopped", () => {
  const dim = new FakeDimension();
  oakTree(dim, 0, 6, { persistent: true });
  breakAs(new FakePlayer(), dim, 0, 0, 0, ItemStack.tool("iron_axe"));
  assert.equal(dim.count("oak_log"), 5);
});

test("pickaxe on a log does nothing extra; axe on an ore does nothing extra", () => {
  const dim = new FakeDimension();
  oakTree(dim);
  breakAs(new FakePlayer(), dim, 0, 0, 0, ItemStack.tool("iron_pickaxe"));
  assert.equal(dim.count("oak_log"), 5);
  dim.set(10, 0, 0, "iron_ore");
  dim.set(11, 0, 0, "iron_ore");
  dim.set(12, 0, 0, "iron_ore");
  breakAs(new FakePlayer(), dim, 10, 0, 0, ItemStack.tool("iron_axe"));
  assert.equal(dim.count("iron_ore"), 2);
});

test("creative mode is left alone", () => {
  const dim = new FakeDimension();
  oakTree(dim);
  breakAs(new FakePlayer({ mode: GameMode.Creative }), dim, 0, 0, 0, ItemStack.tool("iron_axe"));
  assert.equal(dim.count("oak_log"), 5);
});

test("vein miner takes the whole vein, stone + deepslate + diagonal, with XP", () => {
  const dim = new FakeDimension();
  dim.set(0, 0, 0, "diamond_ore");
  dim.set(1, 0, 0, "diamond_ore");
  dim.set(2, 1, 1, "deepslate_diamond_ore"); // diagonal neighbour of (1,0,0)
  dim.set(0, -1, 0, "diamond_ore");
  dim.set(5, 0, 0, "diamond_ore"); // separate vein
  dim.set(0, 1, 0, "coal_ore"); // different ore, untouched
  const p = new FakePlayer();
  const pick = ItemStack.tool("iron_pickaxe", { max: 250 });
  breakAs(p, dim, 0, 0, 0, pick);
  assert.equal(dim.count("diamond_ore"), 1, "only the separate vein remains");
  assert.equal(dim.count("deepslate_diamond_ore"), 0);
  assert.equal(dim.count("coal_ore"), 1);
  assert.equal(total(dim, "minecraft:diamond"), 3);
  assert.ok(p.xp >= 9 && p.xp <= 21, `xp ${p.xp} should be 3 x [3..7]`);
  assert.match(p.actionbar, /\+4 ores/);
});

test("lit and unlit redstone ore count as one vein", () => {
  const dim = new FakeDimension();
  dim.set(0, 0, 0, "redstone_ore");
  dim.set(1, 0, 0, "lit_redstone_ore");
  dim.set(2, 0, 0, "lit_deepslate_redstone_ore");
  breakAs(new FakePlayer(), dim, 0, 0, 0, ItemStack.tool("iron_pickaxe"));
  assert.equal(dim.blocks.size, 0);
});

test("pickaxe too weak for the ore: nothing extra is mined", () => {
  const dim = new FakeDimension();
  for (let x = 0; x < 4; x++) dim.set(x, 0, 0, "diamond_ore");
  breakAs(new FakePlayer(), dim, 0, 0, 0, ItemStack.tool("stone_pickaxe"));
  assert.equal(dim.count("diamond_ore"), 3);
});

test("silk touch drops ore blocks and gives no XP", () => {
  const dim = new FakeDimension();
  for (let x = 0; x < 3; x++) dim.set(x, 0, 0, "emerald_ore");
  const p = new FakePlayer();
  breakAs(p, dim, 0, 0, 0, ItemStack.tool("diamond_pickaxe", { enchants: { silk_touch: 1 } }));
  assert.equal(total(dim, "minecraft:emerald_ore"), 2);
  assert.equal(p.xp, 0);
});

test("tool is never broken: stops with 1 use left and warns", () => {
  const dim = new FakeDimension();
  for (let x = 0; x < 10; x++) dim.set(x, 0, 0, "iron_ore");
  const p = new FakePlayer();
  const pick = ItemStack.tool("stone_pickaxe", { damage: 128, max: 131 });
  breakAs(p, dim, 0, 0, 0, pick);
  assert.equal(pick.getComponent("minecraft:durability").damage, 130);
  assert.equal(dim.count("iron_ore"), 7, "only 2 extra ores mined");
  assert.match(p.actionbar, /almost broken/);
});

test("Unbreaking III saves durability on average", () => {
  const dim = new FakeDimension();
  for (let x = 0; x < 60; x++) dim.set(x, 0, 0, "coal_ore");
  const pick = ItemStack.tool("diamond_pickaxe", { max: 1561, enchants: { unbreaking: 3 } });
  breakAs(new FakePlayer(), dim, 0, 0, 0, pick);
  const dmg = pick.getComponent("minecraft:durability").damage;
  assert.equal(dim.count("coal_ore"), 0);
  assert.ok(dmg > 2 && dmg < 35, `damage ${dmg} should be about 59/4`);
});

test("caps: 64 ores, 256 logs", () => {
  const dim = new FakeDimension();
  for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) dim.set(x, y, 0, "iron_ore");
  breakAs(new FakePlayer(), dim, 0, 0, 0, ItemStack.tool("netherite_pickaxe", { max: 2031 }));
  assert.equal(dim.count("iron_ore"), 99 - 64);

  const d2 = new FakeDimension();
  for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) d2.set(x, y, 0, "jungle_log");
  d2.set(0, 20, 0, "jungle_leaves", { persistent_bit: false });
  breakAs(new FakePlayer(), d2, 0, 0, 0, ItemStack.tool("netherite_axe", { max: 2031 }));
  assert.equal(d2.count("jungle_log"), 399 - 256);
});

test("nether trees: crimson stem with wart blocks", () => {
  const dim = new FakeDimension();
  for (let y = 0; y < 5; y++) dim.set(0, y, 0, "crimson_stem");
  dim.set(1, 4, 0, "nether_wart_block");
  breakAs(new FakePlayer(), dim, 0, 0, 0, ItemStack.tool("diamond_axe", { max: 1561 }));
  assert.equal(dim.count("crimson_stem"), 0);
});

test("stripped logs and mushroom stems are ignored", () => {
  const dim = new FakeDimension();
  for (let y = 0; y < 4; y++) dim.set(0, y, 0, "stripped_oak_log");
  dim.set(1, 3, 0, "oak_leaves", { persistent_bit: false });
  breakAs(new FakePlayer(), dim, 0, 0, 0, ItemStack.tool("iron_axe"));
  assert.equal(dim.count("stripped_oak_log"), 3);
});

test("bare hand / tool that just broke: nothing happens", () => {
  const dim = new FakeDimension();
  oakTree(dim);
  breakAs(new FakePlayer(), dim, 0, 0, 0, undefined);
  assert.equal(dim.count("oak_log"), 5);
});

test("welcome message on first spawn", () => {
  const p = new FakePlayer();
  spawnAs(p);
  assert.match(p.messages[0], /TreeVein/);
});

console.log(`\n${passed} tests passed`);
