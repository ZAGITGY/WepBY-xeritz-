// TreeVein — Tree Capitator + Vein Miner for Minecraft Bedrock.
// Uses only the stable Script API (@minecraft/server 2.2.0): no experimental toggles.
//
//   Sneak + break a log with an axe        -> the whole tree comes down
//   Sneak + break an ore with a pickaxe    -> the whole connected vein is mined
//
// Drops come from the game's own loot tables with the player's tool, so Fortune
// and Silk Touch work like normal mining. Each extra block costs durability
// (Unbreaking respected), and the tool is never broken: mining stops at 1 use left.

import { world, EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";

const CONFIG = {
  requireSneak: true, // false = always on (not recommended: easy to wreck builds)
  maxLogs: 256,
  maxOres: 64,
};

/** Ores that count as one vein together (stone + deepslate + lit variants). */
const ORE_GROUP = new Map([
  ["minecraft:coal_ore", "coal"],
  ["minecraft:deepslate_coal_ore", "coal"],
  ["minecraft:iron_ore", "iron"],
  ["minecraft:deepslate_iron_ore", "iron"],
  ["minecraft:copper_ore", "copper"],
  ["minecraft:deepslate_copper_ore", "copper"],
  ["minecraft:gold_ore", "gold"],
  ["minecraft:deepslate_gold_ore", "gold"],
  ["minecraft:redstone_ore", "redstone"],
  ["minecraft:lit_redstone_ore", "redstone"],
  ["minecraft:deepslate_redstone_ore", "redstone"],
  ["minecraft:lit_deepslate_redstone_ore", "redstone"],
  ["minecraft:lapis_ore", "lapis"],
  ["minecraft:deepslate_lapis_ore", "lapis"],
  ["minecraft:diamond_ore", "diamond"],
  ["minecraft:deepslate_diamond_ore", "diamond"],
  ["minecraft:emerald_ore", "emerald"],
  ["minecraft:deepslate_emerald_ore", "emerald"],
  ["minecraft:quartz_ore", "quartz"],
  ["minecraft:nether_gold_ore", "nether_gold"],
  ["minecraft:ancient_debris", "ancient_debris"],
]);

/** Vanilla XP per ore block: [min, max]. Ores not listed give no XP. */
const ORE_XP = {
  coal: [0, 2],
  redstone: [1, 5],
  lapis: [2, 5],
  diamond: [3, 7],
  emerald: [3, 7],
  quartz: [2, 5],
  nether_gold: [0, 1],
};

/** Blocks that hold up nether "trees" (they have no leaves). */
const NETHER_CANOPY = new Set([
  "minecraft:nether_wart_block",
  "minecraft:warped_wart_block",
  "minecraft:shroomlight",
]);

/** All 26 neighbours: trees and veins often connect diagonally. */
const NEIGHBOURS = [];
for (let dx = -1; dx <= 1; dx++)
  for (let dy = -1; dy <= 1; dy++)
    for (let dz = -1; dz <= 1; dz++) if (dx || dy || dz) NEIGHBOURS.push([dx, dy, dz]);

/** @param {string} id */
function isLog(id) {
  if (id.includes("stripped_") || id === "minecraft:mushroom_stem") return false;
  return id.endsWith("_log") || id.endsWith("_stem");
}

/**
 * Leaves that grew naturally (not placed by a player). Finding these next to the
 * logs is how we tell a real tree from a log cabin.
 * @param {import("@minecraft/server").Block} block
 */
function isNaturalCanopy(block) {
  const id = block.typeId;
  if (NETHER_CANOPY.has(id)) return true;
  if (!id.endsWith("_leaves") && id !== "minecraft:azalea_leaves_flowered") return false;
  try {
    return block.permutation.getState("persistent_bit") !== true;
  } catch {
    return true;
  }
}

/**
 * Flood-fill from `start` (excluded) through blocks accepted by `match`.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} start
 * @param {(b: import("@minecraft/server").Block) => boolean} match
 * @param {number} limit
 * @param {number} minY
 * @param {(b: import("@minecraft/server").Block) => void} [onOther] called for every non-matching neighbour
 * @param {() => boolean} [keepScanning] after `limit` is reached, keep exploring
 *   (up to 4x limit, without collecting more) while this returns true
 */
function collect(dim, start, match, limit, minY, onOther, keepScanning) {
  const maxY = dim.heightRange.max - 1;
  const key = (p) => `${p.x},${p.y},${p.z}`;
  const seen = new Set([key(start)]);
  const queue = [start];
  const found = [];
  for (let i = 0; i < queue.length; i++) {
    if (found.length >= limit && !(keepScanning?.() && i < limit * 4)) break;
    const p = queue[i];
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const q = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
      if (q.y < minY || q.y > maxY) continue;
      const k = key(q);
      if (seen.has(k)) continue;
      seen.add(k);
      let b;
      try {
        b = dim.getBlock(q);
      } catch {
        continue; // unloaded chunk
      }
      if (!b) continue;
      if (match(b)) {
        if (found.length < limit) found.push(b);
        queue.push(q);
      } else if (onOther) {
        onOther(b);
      }
    }
  }
  return found;
}

/** @param {import("@minecraft/server").ItemStack} tool @param {string} id */
function enchantLevel(tool, id) {
  try {
    return tool.getComponent("minecraft:enchantable")?.getEnchantment(id)?.level ?? 0;
  } catch {
    return 0;
  }
}

/** Merge drops into as few stacks as possible so a big tree is one pile, not 200 items. */
/** @param {import("@minecraft/server").ItemStack[]} items */
function mergeStacks(items) {
  const out = [];
  const totals = new Map();
  for (const it of items) {
    if (!it.isStackable) {
      out.push(it);
      continue;
    }
    const t = totals.get(it.typeId);
    if (t) t.count += it.amount;
    else totals.set(it.typeId, { count: it.amount, max: it.maxAmount });
  }
  for (const [typeId, { count, max }] of totals) {
    for (let left = count; left > 0; left -= max) out.push(new ItemStack(typeId, Math.min(left, max)));
  }
  return out;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Block} originBlock the block that was just broken (now air)
 * @param {import("@minecraft/server").BlockPermutation} broken what it was before
 * @param {import("@minecraft/server").ItemStack | undefined} tool the held item after the vanilla break
 */
function handleBreak(player, originBlock, broken, tool) {
  if (CONFIG.requireSneak && !player.isSneaking) return;
  if (!tool) return; // bare hand, or the tool just broke
  if (player.getGameMode() !== GameMode.Survival) return;

  const id = broken.type.id;
  const dim = originBlock.dimension;
  const origin = originBlock.location;
  const loot = world.getLootTableManager();

  /** @type {import("@minecraft/server").Block[]} */
  let blocks;
  let mode;
  let group;

  if (isLog(id) && tool.hasTag("minecraft:is_axe")) {
    mode = "tree";
    let natural = false;
    blocks = collect(
      dim,
      origin,
      (b) => b.typeId === id,
      CONFIG.maxLogs,
      origin.y,
      (b) => {
        if (!natural && isNaturalCanopy(b)) natural = true;
      },
      () => !natural // giant trees: keep looking for the canopy past the log cap
    );
    if (!natural) return; // no natural leaves touching: probably a build, leave it alone
  } else if (ORE_GROUP.has(id) && tool.hasTag("minecraft:is_pickaxe")) {
    mode = "ore";
    group = ORE_GROUP.get(id);
    // undefined = this pickaxe is too weak for the ore (e.g. stone pickaxe on diamond)
    if (loot.generateLootFromBlockPermutation(broken, tool) === undefined) return;
    blocks = collect(dim, origin, (b) => ORE_GROUP.get(b.typeId) === group, CONFIG.maxOres, dim.heightRange.min);
  } else {
    return;
  }
  if (blocks.length === 0) return;

  const durability = tool.getComponent("minecraft:durability");
  const unbreaking = enchantLevel(tool, "unbreaking");
  const silkTouch = enchantLevel(tool, "silk_touch") > 0;
  const drops = [];
  let xp = 0;
  let count = 0;
  let stoppedForTool = false;

  for (const b of blocks) {
    if (durability && Math.random() < 1 / (unbreaking + 1)) {
      if (durability.damage + 1 >= durability.maxDurability) {
        stoppedForTool = true;
        break;
      }
      durability.damage += 1;
    }
    let items;
    try {
      items = loot.generateLootFromBlock(b, tool);
    } catch {
      continue;
    }
    if (items) drops.push(...items);
    if (mode === "ore" && !silkTouch && ORE_XP[group]) {
      const [lo, hi] = ORE_XP[group];
      xp += lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    b.setType("minecraft:air");
    count++;
  }
  if (count === 0) return;

  const at = { x: origin.x + 0.5, y: origin.y + 0.5, z: origin.z + 0.5 };
  for (const stack of mergeStacks(drops)) dim.spawnItem(stack, at);
  if (xp > 0) player.addExperience(xp);
  if (durability) player.getComponent("minecraft:equippable")?.setEquipment(EquipmentSlot.Mainhand, tool);

  dim.playSound(mode === "tree" ? "dig.wood" : "dig.stone", at);
  const what = mode === "tree" ? "logs" : "ores";
  const warn = stoppedForTool ? " §c(tool almost broken - repair it!)" : "";
  player.onScreenDisplay.setActionBar(`§a+${count + 1} ${what}${warn}`);
}

world.afterEvents.playerBreakBlock.subscribe((ev) => {
  try {
    handleBreak(ev.player, ev.block, ev.brokenBlockPermutation, ev.itemStackAfterBreak);
  } catch (e) {
    console.warn(`[TreeVein] ${e}`);
  }
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  ev.player.sendMessage(
    "§e[TreeVein]§r Sneak + axe on a log = whole tree. Sneak + pickaxe on an ore = whole vein."
  );
});
