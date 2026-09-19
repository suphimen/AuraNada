"use strict";
const fs = require("fs");

function load(file, defaults) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return defaults;
  }
}

function save(file, data) {
  try {
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error("Save error:", e);
  }
}

module.exports = { load, save };