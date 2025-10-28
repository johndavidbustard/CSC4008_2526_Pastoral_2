const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "seed.json");

function load() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

function save(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  load,
  save,
  DATA_PATH
};
