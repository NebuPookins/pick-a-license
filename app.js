const { generatedAt, licenses, rules } = window.APP_DATA;
const APPENDIX_ROOT = "https://choosealicense.com/appendix/#";

const allRuleMap = new Map();
const universalPermissions = new Set(
  rules.permissions
    .map((rule) => rule.tag)
    .filter((tag) => licenses.every((license) => license.permissions.includes(tag)))
);

for (const sectionName of ["permissions", "conditions", "limitations"]) {
  for (const rule of rules[sectionName]) {
    const key =
      rule.tag === "patent-use" && sectionName === "limitations"
        ? "patent-use-negative"
        : rule.tag;
    allRuleMap.set(key, {
      ...rule,
      id: key,
      section: sectionName,
    });
  }
}

function appendixUrlFor(ruleId) {
  if (ruleId === "patent-use-state") {
    return `${APPENDIX_ROOT}patent-use`;
  }

  return `${APPENDIX_ROOT}${ruleId.replace("-negative", "")}`;
}

function formatGeneratedAt(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
  }).format(date);
}

const filters = [
  ...rules.permissions
    .filter((rule) => !universalPermissions.has(rule.tag) && rule.tag !== "patent-use")
    .map((rule) => ({
      id: rule.tag,
      label: rule.label,
      description: rule.description,
      url: appendixUrlFor(rule.tag),
      mode: "boolean",
    })),
  {
    id: "patent-use-state",
    label: "Patent use",
    description:
      "Distinguish between licenses that grant contributor patent rights, explicitly deny them, or say nothing specific about patents.",
    url: appendixUrlFor("patent-use-state"),
    mode: "patent",
  },
  ...rules.conditions.map((rule) => ({
    id: rule.tag,
    label: rule.label,
    description: rule.description,
    url: appendixUrlFor(rule.tag),
    mode: "boolean",
  })),
  ...rules.limitations
    .filter((rule) => rule.tag !== "patent-use")
    .map((rule) => ({
      id: rule.tag,
      label: rule.label,
      description: rule.description,
      url: appendixUrlFor(rule.tag),
      mode: "boolean",
    })),
];

const elements = {
  activeFilters: document.querySelector("#active-filters"),
  failedResults: document.querySelector("#failed-results"),
  failedSummary: document.querySelector("#failed-summary"),
  filtersForm: document.querySelector("#filters-form"),
  footerCopy: document.querySelector("#site-footer-copy"),
  resetButton: document.querySelector("#reset-filters"),
  results: document.querySelector("#results"),
  resultsSummary: document.querySelector("#results-summary"),
  sharedPermissions: document.querySelector("#shared-permissions"),
  sharedSummary: document.querySelector("#shared-summary"),
};

function hasRule(license, filterId) {
  if (filterId === "patent-use-negative") {
    return license.limitations.includes("patent-use");
  }

  return (
    license.permissions.includes(filterId) ||
    license.conditions.includes(filterId) ||
    license.limitations.includes(filterId)
  );
}

function patentStateFor(license) {
  if (license.permissions.includes("patent-use")) {
    return "grant";
  }

  if (license.limitations.includes("patent-use")) {
    return "deny";
  }

  return "silent";
}

function getFilterValue(filterId) {
  const field = elements.filtersForm.elements.namedItem(filterId);
  return field ? field.value : "any";
}

function getActiveFilters() {
  return filters
    .map((filter) => ({ ...filter, value: getFilterValue(filter.id) }))
    .filter((filter) => filter.value !== "any");
}

function matchesFilters(license, activeFilters) {
  return activeFilters.every((filter) => {
    if (filter.mode === "patent") {
      return patentStateFor(license) === filter.value;
    }

    const present = hasRule(license, filter.id);
    return filter.value === "yes" ? present : !present;
  });
}

function formatActiveFilter(filter) {
  if (filter.mode === "patent") {
    const labels = {
      grant: "Patent use: express grant",
      deny: "Patent use: explicitly denied",
      silent: "Patent use: no explicit term",
    };
    return labels[filter.value];
  }

  return `${filter.label}: ${filter.value === "yes" ? "Yes" : "No"}`;
}

function formatPatentState(value) {
  const labels = {
    grant: "express patent grant",
    deny: "explicit patent exclusion",
    silent: "no explicit patent term",
  };
  return labels[value];
}

function getFailureReasons(license, activeFilters) {
  return activeFilters.flatMap((filter) => {
    if (filter.mode === "patent") {
      const actualState = patentStateFor(license);

      if (actualState === filter.value) {
        return [];
      }

      return [
        `Expected ${formatPatentState(filter.value)}, but this license has ${formatPatentState(actualState)}.`,
      ];
    }

    const present = hasRule(license, filter.id);
    const expectedPresent = filter.value === "yes";

    if (present === expectedPresent) {
      return [];
    }

    return [
      expectedPresent
        ? `Missing required ${filter.label.toLowerCase()}.`
        : `Includes ${filter.label.toLowerCase()}, but the filter excludes it.`,
    ];
  });
}

function renderFilters() {
  const cards = filters.map((filter) => {
    if (filter.mode === "patent") {
      return `
        <div class="filter-card">
          <label for="${filter.id}">
            <h3><a class="criteria-link" href="${filter.url}" target="_blank" rel="noreferrer">${filter.label}</a></h3>
            <p class="filter-help">${filter.description}</p>
          </label>
          <select id="${filter.id}" name="${filter.id}">
            <option value="any">Don't care</option>
            <option value="grant">Yes, includes an express patent grant</option>
            <option value="deny">No, explicitly denies patent rights</option>
            <option value="silent">No explicit patent term</option>
          </select>
        </div>
      `;
    }

    return `
      <div class="filter-card">
        <label for="${filter.id}">
          <h3><a class="criteria-link" href="${filter.url}" target="_blank" rel="noreferrer">${filter.label}</a></h3>
          <p class="filter-help">${filter.description}</p>
        </label>
        <select id="${filter.id}" name="${filter.id}">
          <option value="any">Don't care</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
    `;
  });

  elements.filtersForm.innerHTML = cards.join("");
}

function renderSharedPermissions(currentLicenses) {
  const shared = rules.permissions.filter((rule) =>
    currentLicenses.every((license) => license.permissions.includes(rule.tag))
  );

  elements.sharedSummary.textContent =
    currentLicenses.length === licenses.length
      ? `Across all ${licenses.length} licenses in the dataset, these permissions are always present.`
      : `Across the ${currentLicenses.length} currently matching licenses, these permissions are always present.`;

  if (!shared.length) {
    elements.sharedPermissions.innerHTML =
      '<div class="empty-state">No permission is shared by every currently matching license.</div>';
    return;
  }

  elements.sharedPermissions.innerHTML = shared
    .map(
      (rule) => `
        <article class="rule-card">
          <h3><a class="criteria-link" href="${appendixUrlFor(rule.tag)}" target="_blank" rel="noreferrer">${rule.label}</a></h3>
          <p class="rule-description">${rule.description}</p>
        </article>
      `
    )
    .join("");
}

function renderResults(currentLicenses, activeFilters) {
  elements.resultsSummary.textContent =
    currentLicenses.length === 1
      ? "1 license matches the current criteria."
      : `${currentLicenses.length} licenses match the current criteria.`;

  elements.activeFilters.innerHTML = activeFilters.length
    ? activeFilters.map((filter) => `<span class="chip">${formatActiveFilter(filter)}</span>`).join("")
    : "";

  if (!currentLicenses.length) {
    elements.results.innerHTML = `
      <div class="empty-state">
        No licenses match this combination. Relax one or more filters to widen the results.
      </div>
    `;
    return;
  }

  elements.results.innerHTML = currentLicenses
    .map((license) => {
      const badges = [];

      if (license.permissions.includes("patent-use")) {
        badges.push('<span class="badge badge-match">Express patent grant</span>');
      } else if (license.limitations.includes("patent-use")) {
        badges.push('<span class="badge">No patent rights granted</span>');
      }

      for (const filter of activeFilters) {
        if (filter.mode === "patent") {
          continue;
        }

        const present = hasRule(license, filter.id);
        badges.push(
          `<span class="badge ${present ? "badge-match" : ""}">${filter.label}: ${
            present ? "Yes" : "No"
          }</span>`
        );
      }

      if (!badges.length) {
        badges.push(`<span class="badge">${license.spdxId}</span>`);
      }

      return `
        <article class="license-card">
          <h3><a href="${license.url}" target="_blank" rel="noreferrer">${license.title}</a></h3>
          <p class="license-description">${license.description}</p>
          <div class="license-meta">${badges.join("")}</div>
        </article>
      `;
    })
    .join("");
}

function renderFailedLicenses(failedLicenses, activeFilters) {
  if (!activeFilters.length) {
    elements.failedSummary.textContent = "Apply one or more filters to see which licenses were excluded and why.";
    elements.failedResults.innerHTML =
      '<div class="empty-state">No licenses have failed yet because no criteria are active.</div>';
    return;
  }

  elements.failedSummary.textContent =
    failedLicenses.length === 1
      ? "1 license failed the current criteria."
      : `${failedLicenses.length} licenses failed the current criteria.`;

  if (!failedLicenses.length) {
    elements.failedResults.innerHTML =
      '<div class="empty-state">Every license in the dataset matches the current criteria.</div>';
    return;
  }

  elements.failedResults.innerHTML = failedLicenses
    .map(({ license, reasons }) => {
      const items = reasons.map((reason) => `<li>${reason}</li>`).join("");

      return `
        <article class="license-card license-card-failed">
          <h3><a href="${license.url}" target="_blank" rel="noreferrer">${license.title}</a></h3>
          <p class="license-description">${license.description}</p>
          <div class="license-meta">
            <span class="badge">${license.spdxId}</span>
          </div>
          <ul class="failure-reasons">${items}</ul>
        </article>
      `;
    })
    .join("");
}

function update() {
  const activeFilters = getActiveFilters();
  const currentLicenses = licenses.filter((license) => matchesFilters(license, activeFilters));
  const failedLicenses = licenses
    .filter((license) => !matchesFilters(license, activeFilters))
    .map((license) => ({
      license,
      reasons: getFailureReasons(license, activeFilters),
    }));

  renderSharedPermissions(currentLicenses);
  renderResults(currentLicenses, activeFilters);
  renderFailedLicenses(failedLicenses, activeFilters);
}

elements.footerCopy.textContent = `Copyright 2026 Nebu Pookins. Last updated on ${formatGeneratedAt(generatedAt)}.`;

elements.resetButton.addEventListener("click", () => {
  elements.filtersForm.reset();
  update();
});

elements.filtersForm.addEventListener("input", update);

renderFilters();
update();
