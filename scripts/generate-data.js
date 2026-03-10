const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SOURCE_REPO = "https://github.com/github/choosealicense.com.git";
const SOURCE_ROOT = path.join(os.tmpdir(), "choosealicense.com");
const RULES_PATH = path.join(SOURCE_ROOT, "_data", "rules.yml");
const LICENSES_DIR = path.join(SOURCE_ROOT, "_licenses");
const OUTPUT_PATH = path.join(process.cwd(), "data.js");

function runGit(args, cwd) {
  childProcess.execFileSync("git", args, {
    cwd,
    stdio: "inherit",
  });
}

function ensureSourceRepo() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    runGit(["clone", SOURCE_REPO, SOURCE_ROOT]);
    return;
  }

  if (!fs.existsSync(path.join(SOURCE_ROOT, ".git"))) {
    throw new Error(`${SOURCE_ROOT} exists but is not a git repository.`);
  }

  runGit(["pull", "--ff-only"], SOURCE_ROOT);
}

function parseRulesYaml(input) {
  const sections = {};
  let currentSection = null;
  let currentRule = null;

  for (const rawLine of input.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) {
      continue;
    }

    const sectionMatch = line.match(/^([a-z-]+):$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sections[currentSection] = [];
      currentRule = null;
      continue;
    }

    const ruleStartMatch = line.match(/^- description:\s*(.+)$/);
    if (ruleStartMatch) {
      currentRule = { description: ruleStartMatch[1] };
      sections[currentSection].push(currentRule);
      continue;
    }

    const propertyMatch = line.match(/^\s{2}([a-z-]+):\s*(.+)$/);
    if (propertyMatch && currentRule) {
      currentRule[propertyMatch[1]] = propertyMatch[2];
    }
  }

  return sections;
}

function parseLicenseFile(input, fileName) {
  const frontMatterMatch = input.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    throw new Error(`Missing front matter in ${fileName}`);
  }

  const meta = {
    id: fileName.replace(/\.txt$/, ""),
    permissions: [],
    conditions: [],
    limitations: [],
  };

  let currentList = null;

  for (const rawLine of frontMatterMatch[1].split("\n")) {
    const line = rawLine.replace(/\r$/, "");

    if (!line.trim()) {
      currentList = null;
      continue;
    }

    const listItemMatch = line.match(/^\s{2}-\s+(.+)$/);
    if (listItemMatch && currentList) {
      meta[currentList].push(listItemMatch[1]);
      continue;
    }

    const keyMatch = line.match(/^([a-z-]+):\s*(.*)$/);
    if (!keyMatch) {
      continue;
    }

    const key = keyMatch[1];
    const value = keyMatch[2];

    if (key === "permissions" || key === "conditions" || key === "limitations") {
      currentList = key;
      continue;
    }

    currentList = null;
    meta[key] = value;
  }

  return {
    id: meta.id,
    title: meta.title,
    spdxId: meta["spdx-id"],
    description: meta.description || "",
    url: `https://choosealicense.com/licenses/${meta.id}/`,
    permissions: meta.permissions,
    conditions: meta.conditions,
    limitations: meta.limitations,
  };
}

function loadRules() {
  const raw = fs.readFileSync(RULES_PATH, "utf8");
  return parseRulesYaml(raw);
}

function loadLicenses() {
  return fs
    .readdirSync(LICENSES_DIR)
    .filter((fileName) => fileName.endsWith(".txt"))
    .map((fileName) => {
      const raw = fs.readFileSync(path.join(LICENSES_DIR, fileName), "utf8");
      return parseLicenseFile(raw, fileName);
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

ensureSourceRepo();

const payload = {
  generatedAt: new Date().toISOString(),
  source: "https://github.com/github/choosealicense.com",
  rules: loadRules(),
  licenses: loadLicenses(),
};

const output = `window.APP_DATA = ${JSON.stringify(payload, null, 2)};\n`;
fs.writeFileSync(OUTPUT_PATH, output);
console.log(`Wrote ${OUTPUT_PATH} with ${payload.licenses.length} licenses.`);
