// Minimal stand-in for @minecraft/server so main.js can be exercised in Node.
// Only models what main.js touches.

export const GameMode = { Survival: "Survival", Creative: "Creative", Adventure: "Adventure", Spectator: "Spectator" };
export const EquipmentSlot = { Mainhand: "Mainhand" };

const STACK_MAX = { "minecraft:diamond_pickaxe": 1, "minecraft:iron_axe": 1 };
const TIER = { wooden: 0, golden: 0, stone: 1, copper: 1, iron: 2, diamond: 3, netherite: 4 };
const ORE_NEEDS = { coal: 0, copper: 1, iron: 1, lapis: 1, gold: 2, redstone: 2, diamond: 2, emerald: 2, quartz: 0, nether_gold: 0, ancient_debris: 3 };
const ORE_DROP = {
  coal: ["minecraft:coal", 1], iron: ["minecraft:raw_iron", 1], diamond: ["minecraft:diamond", 1],
  redstone: ["minecraft:redstone", 4], lapis: ["minecraft:lapis_lazuli", 6],
};

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId.includes(":") ? typeId : `minecraft:${typeId}`;
    this.amount = amount;
    this.maxAmount = STACK_MAX[this.typeId] ?? 64;
    this.isStackable = this.maxAmount > 1;
    this._components = {};
    this._enchants = {};
  }
  hasTag(tag) {
    if (tag === "minecraft:is_axe") return this.typeId.endsWith("_axe");
    if (tag === "minecraft:is_pickaxe") return this.typeId.endsWith("_pickaxe");
    return false;
  }
  getComponent(id) {
    if (id === "minecraft:durability") return this._components.durability;
    if (id === "minecraft:enchantable") {
      const e = this._enchants;
      return { getEnchantment: (n) => (e[n] ? { level: e[n] } : undefined) };
    }
    return undefined;
  }
  static tool(typeId, { damage = 0, max = 250, enchants = {} } = {}) {
    const s = new ItemStack(typeId);
    s._components.durability = { damage, maxDurability: max };
    s._enchants = enchants;
    return s;
  }
}

const oreGroupOf = (id) => {
  const m = id.match(/^minecraft:(?:lit_)?(?:deepslate_)?(coal|iron|copper|gold|redstone|lapis|diamond|emerald|quartz|nether_gold)_ore$/);
  if (m) return m[1];
  return id === "minecraft:ancient_debris" ? "ancient_debris" : undefined;
};
const toolTier = (tool) => {
  const m = tool?.typeId.match(/minecraft:(\w+?)_pickaxe/);
  return m ? TIER[m[1]] ?? -1 : -1;
};

function lootFor(typeId, tool) {
  const g = oreGroupOf(typeId);
  if (g) {
    if (toolTier(tool) < ORE_NEEDS[g]) return undefined;
    if (tool?._enchants?.silk_touch) return [new ItemStack(typeId, 1)];
    const [item, n] = ORE_DROP[g] ?? [typeId, 1];
    return [new ItemStack(item, n)];
  }
  return [new ItemStack(typeId, 1)];
}

export class FakeDimension {
  constructor() {
    this.blocks = new Map(); // "x,y,z" -> { typeId, states }
    this.spawned = [];
    this.sounds = [];
    this.heightRange = { min: -64, max: 320 };
  }
  set(x, y, z, typeId, states = {}) {
    this.blocks.set(`${x},${y},${z}`, { typeId: `minecraft:${typeId}`, states });
  }
  typeAt(x, y, z) {
    return this.blocks.get(`${x},${y},${z}`)?.typeId ?? "minecraft:air";
  }
  count(typeId) {
    let n = 0;
    for (const b of this.blocks.values()) if (b.typeId === `minecraft:${typeId}`) n++;
    return n;
  }
  getBlock({ x, y, z }) {
    const dim = this;
    const k = `${x},${y},${z}`;
    return {
      location: { x, y, z },
      dimension: dim,
      get typeId() {
        return dim.blocks.get(k)?.typeId ?? "minecraft:air";
      },
      get permutation() {
        const b = dim.blocks.get(k);
        return { getState: (s) => b?.states?.[s] };
      },
      setType(t) {
        if (t === "minecraft:air") dim.blocks.delete(k);
        else dim.blocks.set(k, { typeId: t, states: {} });
      },
    };
  }
  spawnItem(stack, at) {
    this.spawned.push({ typeId: stack.typeId, amount: stack.amount, at });
  }
  playSound(id) {
    this.sounds.push(id);
  }
}

export class FakePlayer {
  constructor({ sneaking = true, mode = GameMode.Survival } = {}) {
    this.isSneaking = sneaking;
    this.mode = mode;
    this.xp = 0;
    this.mainhand = undefined;
    this.actionbar = "";
    this.messages = [];
    this.onScreenDisplay = { setActionBar: (t) => (this.actionbar = t) };
  }
  getGameMode() {
    return this.mode;
  }
  addExperience(n) {
    this.xp += n;
    return this.xp;
  }
  sendMessage(m) {
    this.messages.push(m);
  }
  getComponent(id) {
    if (id === "minecraft:equippable") return { setEquipment: (_slot, item) => (this.mainhand = item) };
  }
}

const handlers = { breakBlock: [], spawn: [] };
export const world = {
  afterEvents: {
    playerBreakBlock: { subscribe: (f) => handlers.breakBlock.push(f) },
    playerSpawn: { subscribe: (f) => handlers.spawn.push(f) },
  },
  getLootTableManager: () => ({
    generateLootFromBlock: (block, tool) => lootFor(block.typeId, tool),
    generateLootFromBlockPermutation: (perm, tool) => lootFor(perm.type.id, tool),
  }),
};

/** Simulate the vanilla break of one block by `player`, then fire the after-event. */
export function breakAs(player, dim, x, y, z, tool) {
  const typeId = dim.typeAt(x, y, z);
  dim.blocks.delete(`${x},${y},${z}`);
  const ev = {
    player,
    block: dim.getBlock({ x, y, z }),
    brokenBlockPermutation: { type: { id: typeId } },
    itemStackAfterBreak: tool,
  };
  for (const f of handlers.breakBlock) f(ev);
}
export function spawnAs(player) {
  for (const f of handlers.spawn) f({ player, initialSpawn: true });
}
