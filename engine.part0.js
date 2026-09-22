/**
 * STASIS Episode 0 — browser/Node engine (mirrors trek_rpg/engine.py).
 * No DOM. Returns structured lines for the UI or tests.
 */

const DEFAULT_STATS = { str: 13, dex: 14, con: 12, int: 15, wis: 11, cha: 10 };
const DEFAULT_FLAGS = {
  know_name: 0, seen_stencil: 0, harness_off: 0, pod_open: 0, hatch_open: 0,
  field_down: 0, species_known: 0, in_sickbay: 0, in_brig: 0, mem_payload: 0,
  voss_trust: 0, korrak_trust: 0, quinn_trust: 0, medical_called: 0, spoke: 0,
  episode_done: 0,
};

const HELP = `moving / looking
  look                 where you are
  examine <thing>      look closer (stencil, hatch, field, tag...)
  go <exit>            hatch, out, back, bay, corridor, sickbay, brig, mess, control
  listen               voices through the shell
  wait

body
  feel                 what the body knows
  open / hatch         work the inner door
  stand / climb        get out of the cradle
  remember             reach for a fragment
  say <words>          speak out loud
  talk <name>          voss, korrak, quinn
  try <action>         force the wheel, pick the panel...

meta
  sheet   inventory   log   save   help   quit   new`;

const ALIASES = {
  l: "look", x: "examine", i: "inventory", inv: "inventory",
  n: "go", out: "go", open: "hatch", hatch: "hatch",
  climb: "stand", speak: "say", "?": "help", q: "quit",
};

const MOD = { 8: -1, 9: -1, 10: 0, 11: 0, 12: 1, 13: 1, 14: 2, 15: 2, 16: 3, 17: 3, 18: 4 };

function modifier(score) {
  if (score in MOD) return MOD[score];
  return Math.floor((score - 10) / 2);
}

function describeRoll(result) {
  let mark = result.ok ? "success" : "miss";
  if (result.crit) mark = "critical";
  if (result.fumble) mark = "fumble";
  const sign = result.bonus >= 0 ? `+${result.bonus}` : `${result.bonus}`;
  return `d20 ${result.d20}${sign} = ${result.total} vs DC ${result.dc} (${mark})`;
}

function strip(s) {
  return (s || "").replace(/\n+$/, "").replace(/^\n+/, "");
}

export class SaveState {
  constructor(data) {
    if (data) {
      Object.assign(this, structuredClone(data));
      return;
    }
    this.meta = { stardate: "47621.4", ship: "U.S.S. Amberjack", episode: "0" };
    this.flags = { ...DEFAULT_FLAGS };
    this.player = {
      name: "Rroll", hp: 9, hp_max: 12, location_id: "pod_interior",
      species_revealed: null, role_revealed: null,
    };
    this.stats = {};
    for (const [a, v] of Object.entries(DEFAULT_STATS)) {
      this.stats[a] = { value: v, revealed: 0 };
    }
    this.skills = {
      technology: { rating: 2, revealed: 0 },
      perception: { rating: 2, revealed: 0 },
      athletics: { rating: 2, revealed: 0 },
      insight: { rating: 2, revealed: 0 },
    };
    this.inventory = [];
    this.npcs = {
      voss: { location_id: "containment_bay", disposition: 0, flags: "" },
      korrak: { location_id: "bay_control", disposition: -1, flags: "" },
      quinn: { location_id: "sickbay_triage", disposition: 1, flags: "" },
    };
    this.visits = {};
    this.logbook = [];
    this.memories = [];
  }

  toJSON() {
    return {
      meta: this.meta, flags: this.flags, player: this.player, stats: this.stats,
      skills: this.skills, inventory: this.inventory, npcs: this.npcs,
      visits: this.visits, logbook: this.logbook, memories: this.memories,
    };
  }

  flag(k) { return this.flags[k] || 0; }
  setFlag(k, v) { this.flags[k] = v; }
  bump(k, d = 1) { this.flags[k] = (this.flags[k] || 0) + d; return this.flags[k]; }
  visited(loc) { return !!this.visits[loc]; }
  markVisit(loc) { this.visits[loc] = 1; }
  setLocation(loc) { this.player.location_id = loc; }
  setHp(hp) {
    this.player.hp = Math.max(0, Math.min(hp, this.player.hp_max));
  }
  stat(attr) {
    const s = this.stats[attr];
    return [s.value, s.revealed];
  }
  revealStat(attr) { this.stats[attr].revealed = 1; }
  revealSkill(skill) { if (this.skills[skill]) this.skills[skill].revealed = 1; }
  skillKnown(skill) { return !!(this.skills[skill] && this.skills[skill].revealed); }
  npc(id) { return this.npcs[id]; }
  moveNpc(id, loc) { this.npcs[id].location_id = loc; }
  disposition(id) { return this.npcs[id]?.disposition ?? 0; }
  addDisposition(id, d) { this.npcs[id].disposition += d; }
  remember(text, importance = 1) {
    this.memories.push({ stardate: this.meta.stardate, text, importance });
  }
  log(text) {
    this.logbook.push({ stardate: this.meta.stardate, text });
  }
  addItem(itemId, qty = 1) {
    const row = this.inventory.find((i) => i.item_id === itemId);
    if (row) row.qty += qty;
    else this.inventory.push({ item_id: itemId, qty, equipped: 0 });
  }
}

export class Game {
  /**
   * @param {object} content - {locations,npcs,items,fragments}
   * @param {SaveState} [save]
   * @param {{rng?: () => number}} [opts] - rng returns 0..1; used for d20
   */
  constructor(content, save = null, opts = {}) {
    this.content = content;
    this.locations = content.locations;
    this.npcs = content.npcs;
    this.items = content.items || {};
    this.fragments = content.fragments || {};
    this.save = save || new SaveState();
    this._rng = opts.rng || Math.random;
    this._forcedRolls = Array.isArray(opts.forcedRolls) ? [...opts.forcedRolls] : [];
    this.lines = [];
    this.quitRequested = false;
  }

  /** Force next d20 values (1-20) for tests. */
  forceRolls(...vals) {
    this._forcedRolls.push(...vals);
  }

  roll(score, trained = false, dc = 12) {
    let d20;
    if (this._forcedRolls.length) d20 = this._forcedRolls.shift();
    else d20 = 1 + Math.floor(this._rng() * 20);
    const bonus = modifier(score) + (trained ? 2 : 0);
    const total = d20 + bonus;
    return {
      d20, bonus, total, dc,
      ok: total >= dc || d20 === 20,
      crit: d20 === 20,
      fumble: d20 === 1,
    };
  }

  // --- output helpers ---
  _push(kind, text, speaker = null) {
    const t = strip(String(text ?? ""));
    if (!t && kind !== "rule") return;
    this.lines.push({ kind, text: t, speaker });
  }
  story(t) { this._push("story", t); }
  info(t) { this._push("info", t); }
  ok(t) { this._push("ok", t); }
  say(name, t, _color) { this._push("say", t, name); }
  rule(t) { this._push("rule", t); }

  takeLines() {
    const out = this.lines;
    this.lines = [];
    return out;
  }

  get locId() { return this.save.player.location_id; }
  get loc() { return this.locations[this.locId]; }
  flag(k) { return this.save.flag(k); }

  visibleName() {
    if (this.flag("know_name") || this.flag("seen_stencil")) return "Rroll";
    return "???";
  }

  statusLine() {
    const p = this.save.player;
    return `${this.loc.name}   ·   ${this.visibleName()}   ·   ${p.hp}/${p.hp_max}   ·   Stardate ${this.save.meta.stardate}`;
  }

  peopleHere() {
    const here = [];
    for (const npcId of Object.keys(this.npcs)) {
      const row = this.save.npc(npcId);
      if (!row) continue;
      if (npcId === "quinn" && !this.flag("medical_called") && row.location_id === "sickbay_triage") {
        if (this.locId !== "sickbay_triage") continue;
      }
      if (row.location_id === this.locId) here.push(npcId);
    }
    if (this.locId === "containment_bay" && !here.includes("korrak")) {
      const k = this.save.npc("korrak");
      if (k && k.location_id === "bay_control") here.push("korrak");
    }
    return here;
  }

  move(dest) {
    const first = !this.save.visited(dest);
    this.save.setLocation(dest);
    this.save.markVisit(dest);
    const loc = this.locations[dest];
    this.rule(loc.name);
