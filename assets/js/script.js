let encounterData = null;
let encountersByInstance;
// 1) Fetch all 4 JSONs in parallel:
// 1) Fetch all 4 JSONs in parallel
Promise.all([
  fetch("/data/JournalTier.json").then((r) => r.json()),
  fetch("/data/journalTierXinstance.json").then((r) => r.json()),
  fetch("/data/journalInstance.json").then((r) => r.json()),
  fetch("/data/JournalEncounter.json").then((r) => r.json()),
])
  .then(([tiers, tierToInstances, instances, encounterGroups]) => {
    encountersByInstance = Object.values(encounterGroups) // [[...], [...], …]
      .flat() // [enc1, enc2, …]
      .reduce((map, enc) => {
        const key = String(enc.JournalInstanceID);
        if (!map[key]) map[key] = [];
        map[key].push(enc);
        return map;
      }, {});

    // Now encountersByInstance[instID] is an array of all that instance’s encounters

    populateEncounterDropdown(
      tiers,
      tierToInstances,
      instances,
      encounterGroups
    );
  })
  .catch((err) => console.error("Error loading data:", err));

// containers for your templates
let ExportData, DynamicGroupTemplate, IconTemplate, MetaData;
const Triggers = {}; // ← will hold all the trigger‑JSONs

// 1) Fetch the 4 core templates + metadata
const coreFetches = [
  fetch("/templates/ExportData.json").then((r) => r.json()),
  fetch("/templates/aura_types/DynamicGroup.json").then((r) => r.json()),
  fetch("/templates/aura_types/Icon.json").then((r) => r.json()),
  fetch("/data/metadata.json").then((r) => r.json()),
];

// 2) Fetch the triggers index
const triggersIndexFetch = fetch("/templates/triggers/triggerIndex.json").then(
  (r) => r.json()
); // returns ["triggerA.json", ...] :contentReference[oaicite:0]{index=0}

Promise.all([Promise.all(coreFetches), triggersIndexFetch])
  .then(([[exportData, DynamicGroup, Icon, metadata], triggerFiles]) => {
    // assign core templates
    ExportData = exportData;
    DynamicGroupTemplate = DynamicGroup;
    IconTemplate = Icon;
    MetaData = metadata;

    // 3) now fetch each trigger JSON in parallel
    return Promise.all(
      triggerFiles.map((fileName) =>
        fetch(`/templates/triggers/${fileName}`)
          .then((r) => r.json())
          .then((json) => {
            // strip “.json” off the key, e.g. "triggerA"
            const key = fileName.replace(/\.json$/, "");
            Triggers[key] = json;
          })
      )
    );
  })
  .catch((err) => console.error("Error loading templates or triggers:", err));

function populateEncounterDropdown(
  tiers,
  tierToInstances,
  instances,
  encounterGroups
) {
  const $sel = $("#encounter");
  const select = document.getElementById("encounter");
  select.innerHTML = "";

  // 2) Identify the Current Season tier ID
  const [currentTierID] =
    Object.entries(tiers).find(([id, t]) => t.Name_lang === "Current Season") ||
    [];

  // 3) Pull out every (instID, mapping) for that tier
  const currentMappings = Object.entries(tierToInstances).flatMap(
    ([instID, maps]) =>
      maps
        .filter((m) => String(m.JournalTierID) === currentTierID)
        .map((m) => ({ instID, cond: m.AvailabilityCondition }))
  );

  if (currentMappings.length) {
    // 3a) Find the max AvailabilityCondition
    const maxCond = Math.max(...currentMappings.map((x) => x.cond));

    const activeIDs = currentMappings
      .filter((x) => x.cond === maxCond)
      .map((x) => x.instID);
    const prevIDs = currentMappings
      .filter((x) => x.cond < maxCond)
      .map((x) => x.instID);

    // Helper to build an optgroup for a list of instance-IDs
    function buildGroup(label, instIDs) {
      if (!instIDs.length) return;
      const grp = document.createElement("optgroup");
      grp.label = label;

      instIDs.forEach((instID) => {
        // instance header
        const hdr = document.createElement("option");
        hdr.text = instances[instID].Name_lang;
        hdr.disabled = true;
        hdr.classList.add("text-muted");
        grp.appendChild(hdr);
        const encounters = encountersByInstance[instID] || [];
        const seen = new Set();
        const instanceEncounters = [];
        for (let enc of encounters) {
          if (!seen.has(enc.DungeonEncounterID)) {
            seen.add(enc.DungeonEncounterID);
            instanceEncounters.push(enc);
          }
        }
        instanceEncounters.sort((a, b) => a.OrderIndex - b.OrderIndex);

        instanceEncounters.forEach((enc) => {
          const opt = document.createElement("option");
          opt.value = enc.DungeonEncounterID;
          opt.text = `${enc.Name_lang} (${enc.DungeonEncounterID})`;
          grp.appendChild(opt);
        });

        const divider = document.createElement("option");
        divider.setAttribute("data-divider", "true");
        grp.appendChild(divider);
      });

      select.appendChild(grp);
    }

    // 4) Build Active Season + Previous Seasons groups
    buildGroup("Active Season", activeIDs);
    buildGroup("Previous Seasons", prevIDs);
  }

  // 5) Now the rest of the tiers, sorted by Expansion
  const otherTiers = Object.entries(tiers)
    .filter(([id]) => id !== currentTierID)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.Expansion - a.Expansion);

  otherTiers.forEach((t) => {
    // collect all instIDs that map to this tier
    const instIDs = Object.entries(tierToInstances).flatMap(([instID, maps]) =>
      maps.filter((m) => String(m.JournalTierID) === t.id).map((_) => instID)
    );
    if (!instIDs.length) return;

    // make one optgroup per expansion
    const grp = document.createElement("optgroup");
    grp.label = t.Name_lang;

    instIDs.forEach((instID) => {
      const hdr = document.createElement("option");
      hdr.text = instances[instID].Name_lang;
      hdr.disabled = true;
      hdr.classList.add("text-muted");
      grp.appendChild(hdr);

      const encounters = encountersByInstance[instID] || [];
      const seen = new Set();
      const instanceEncounters = [];
      for (let enc of encounters) {
        if (!seen.has(enc.DungeonEncounterID)) {
          seen.add(enc.DungeonEncounterID);
          instanceEncounters.push(enc);
        }
      }
      instanceEncounters.sort((a, b) => a.OrderIndex - b.OrderIndex);

      instanceEncounters.forEach((enc) => {
        const opt = document.createElement("option");
        opt.value = enc.DungeonEncounterID;
        opt.text = `${enc.Name_lang} (${enc.DungeonEncounterID})`;
        grp.appendChild(opt);
      });

      const divider = document.createElement("option");
      divider.setAttribute("data-divider", "true");
      grp.appendChild(divider);
    });

    select.appendChild(grp);
  });

  // 6) Refresh Bootstrap‑Select
  $sel.selectpicker("refresh");
}

$(document).ready(() => {
  $(".selectpicker").selectpicker();
});

$(document).ready(function () {
  $(".selectpicker").selectpicker();
});

document.addEventListener("DOMContentLoaded", function () {
  const addTimeInputButton = document.getElementById("addTimeInputButton");
  const timeInputsContainer = document.getElementById("timeInputsContainer");

  let timeInputCount = 0;

  addTimeInputButton.addEventListener("click", function () {
    timeInputCount++;

    const timeInputDiv = document.createElement("div");
    timeInputDiv.classList.add("input-group", "mb-2");

    const timeInput = document.createElement("input");
    timeInput.type = "text";
    timeInput.classList.add("form-control");
    timeInput.placeholder = "Enter time in seconds";

    const timeInputAppend = document.createElement("div");
    timeInputAppend.classList.add("input-group-append");

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.classList.add("btn", "btn-danger");
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", function () {
      timeInputDiv.remove();
    });

    timeInputAppend.appendChild(deleteButton);
    timeInputDiv.appendChild(timeInput);
    timeInputDiv.appendChild(timeInputAppend);

    timeInputsContainer.appendChild(timeInputDiv);
  });
});

function generateWeakAura() {
  let group = createGroupToExport("TestGroup");
  let aura = JSON.parse(JSON.stringify(IconTemplate)); // get a copy of the Icon Template

  const encounterTime = "24";
  const fontSize = document.getElementById("fontSize").value || "20";
  const font = document.getElementById("font").value || "Friz Quadrata TT";
  const selectedEncounters = Array.from(
    document.getElementById("encounter").selectedOptions || []
  )
    .map((option) => option.value)
    .filter((val) => val !== "");
  const encounterString =
    selectedEncounters.map((encounter) => `${encounter}`).join(",") || "";

  // temp trigger setting for testing
  let trigger = JSON.parse(JSON.stringify(Triggers.encounter)); // get a copy of the encounterTime Trigger Template
  trigger.duration = encounterTime;
  addTrigger(aura, trigger);

  aura.fontSize = parseInt(fontSize, 10);
  aura.font = font;
  aura.load.encounterid = encounterString;
  aura.uid = "WeakAurasCreator_" + Date.now();

  // add aura to group
  aura.parent = group.d.uid;
  aura.preferToUpdate = true;
  //sets other table values depending on parent group
  aura.wagoID = group.d.wagoID;
  aura.version = group.d.version;
  aura.source = group.d.source;
  aura.tocversion = group.d.tocversion;
  aura.semver = group.d.semver;
  aura.internalVersion = group.d.internalVersion;
  aura.url = group.d.url;
  // add aura into group
  addAura(group, aura);

  // Serialize
  let serializedAura = serialize(group);
  // Deflate
  let deflatedData = deflate(serializedAura);
  // Encode
  let encodedString = encode(deflatedData);
  // Output
  document.getElementById("output").value = `!WA:1!${encodedString}`;
  document.getElementById("copyButton").disabled = false;
}

function addTrigger(aura, trigger) {
  const existingKeys = Object.keys(aura.triggers)
    .map((k) => parseInt(k, 10))
    .filter((n) => !isNaN(n));
  const newIndex = existingKeys.length ? Math.max(...existingKeys) + 1 : 1;

  aura.triggers[newIndex] = trigger;
  aura.triggers.activeTriggerMode = -10;
}

function addAura(group, aura) {
  const existingKeys = Object.keys(group.c)
    .map((k) => parseInt(k, 10))
    .filter((n) => !isNaN(n));
  const newIndex = existingKeys.length ? Math.max(...existingKeys) + 1 : 1;
  group.c[newIndex] = aura;
  group.d.sortHybridTable[aura.id] = false;
}

function getTocVersion() {
  const buildStr = MetaData.wowBuild; // e.g. "11.1.0.60257"
  const parts = buildStr.split("."); // ["11","1","0","60257"] :contentReference[oaicite:0]{index=0}

  // Destructure only the first three segments; ignore anything after the third dot
  const [major, minor, patch] = parts;

  // Convert to numbers and compute TOC version: major*10000 + minor*100 + patch
  const tocversion =
    parseInt(major, 10) * 10000 +
    parseInt(minor, 10) * 100 +
    parseInt(patch, 10); // e.g. 11*10000 + 1*100 + 0 = 110100 :contentReference[oaicite:1]{index=1}

  return tocversion;
}

function createGroupToExport(name) {
  let ExportTable = JSON.parse(JSON.stringify(ExportData)); // get a copy of the ExportTemplate
  ExportTable.d = JSON.parse(JSON.stringify(DynamicGroupTemplate)); // get a Copy of the DynamicGroup Template
  // set Aura Name
  let id = "WACreator_" + name;
  ExportTable.d.id = id;
  // set Aura Unique Identifier
  let uid = id + "UID";
  ExportTable.d.uid = uid;
  // set wagoID
  let wagoID = uid;
  ExportTable.d.wagoID = wagoID;
  //export table version
  let version = 0;
  let semver = "1.0." + version;
  // group version
  ExportTable.d.version = version;
  ExportTable.d.semver = semver;
  //set url so updating works (because of how WA internal updating works)
  ExportTable.d.url = "https://wago.io/" + name + "/" + version;
  //calculate and set tocversion
  let tocversion = getTocVersion(); // extracts current tocversion from buildnumber
  ExportTable.d.tocversion = tocversion;
  // set source
  let source = "import";
  ExportTable.d.source = source;
  //set internal version
  let internalVersion = 66; // WA internal version
  ExportTable.d.internalVersion = internalVersion;

  //set group limit
  ExportTable.d.limit = 100;
  //set group grow
  ExportTable.d.grow = "DOWN";
  ExportTable.d.align = "CENTER";
  ExportTable.d.stagger = 0;
  ExportTable.d.space = 0;
  //set offset
  let xOffset = 0;
  let yOffset = 0;

  ExportTable.d.xOffset = xOffset;
  ExportTable.d.yOffset = yOffset;
  return ExportTable;
}

window.generateWeakAura = generateWeakAura;

function copyToClipboard() {
  const textarea = document.getElementById("output");
  textarea.select();
  document.execCommand("copy");

  const popup = document.getElementById("popupMessage");
  popup.style.display = "block";

  setTimeout(() => {
    popup.style.display = "none";
  }, 3000);
}
window.copyToClipboard = copyToClipboard;

function handleTriggerChange() {
  const triggerValue = document.getElementById("trigger").value;

  if (triggerValue === "encounterTime") {
    document.getElementById("encounterTimeField").style.display = "block";
    document.getElementById("encounterField").style.display = "block";
  } else {
    document.getElementById("encounterTimeField").style.display = "none";
    document.getElementById("encounterField").style.display = "none";
  }

  handleAuraTypeChange();
}
window.handleTriggerChange = handleTriggerChange;

function handleAuraTypeChange() {
  const auraTypeValue = document.getElementById("auraType").value;

  if (auraTypeValue === "Progress Bar" || auraTypeValue === "Icon") {
    document.getElementById("sizeFields").style.display = "block";
    document.getElementById("heightField").style.display = "block";
    document.getElementById("fontSizeField").style.display = "none";
  } else if (auraTypeValue === "Text") {
    document.getElementById("sizeFields").style.display = "none";
    document.getElementById("heightField").style.display = "none";
    document.getElementById("fontSizeField").style.display = "block";
  } else {
    document.getElementById("sizeFields").style.display = "none";
    document.getElementById("heightField").style.display = "none";
    document.getElementById("fontSizeField").style.display = "none";
  }
}

document
  .getElementById("auraType")
  .addEventListener("change", handleAuraTypeChange);
