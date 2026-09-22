      return;
    }
    const method = this[`cmd_${verb}`];
    if (typeof method === "function") {
      method.call(this, arg);
      return;
    }
    const exits = this.loc.exits || {};
    if (verb in exits || ["out", "back", "bay", "corridor", "sickbay", "brig", "mess", "control"].includes(verb)) {
      this.cmd_go(verb === "go" ? arg : verb);
      return;
    }
    this.info("You don't remember the word for that. Try help.");
  }

  handle(raw) {
    this.lines = [];
    this.dispatch(raw);
    return this.takeLines();
  }

  openingText() {
    this.lines = [];
    this._opening();
    return this.takeLines();
  }
}

export function createGame(content, saveData = null, opts = {}) {
  const save = saveData ? new SaveState(saveData) : new SaveState();
  return new Game(content, save, opts);
}

export { describeRoll, modifier, HELP };
