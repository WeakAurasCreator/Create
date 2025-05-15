// containers for your templates
let ExportData, DynamicGroupTemplate, IconTemplate, EmptyRegionTemplate, MetaData;
const Triggers = {}; // ← will hold all the trigger‑JSONs
const Data = {};

// 1) Fetch the 4 core templates + metadata
const coreFetches = [
  fetch("templates/ExportData.json").then((r) => r.json()),
  fetch("templates/aura_types/DynamicGroup.json").then((r) => r.json()),
  fetch("templates/aura_types/Icon.json").then((r) => r.json()),
  fetch("templates/aura_types/emptyRegion.json").then((r) => r.json()),
  fetch("data/metadata.json").then((r) => r.json()),
];

// 2) Fetch the triggers index
const triggersIndexFetch = fetch("templates/triggers/triggerIndex.json").then(
  (r) => r.json()
); // returns ["triggerA.json", ...]

const dataIndexFetch = fetch("templates/data/dataIndex.json").then((r) =>
  r.json()
);
Promise.all([Promise.all(coreFetches), triggersIndexFetch, dataIndexFetch])
  .then(
    ([[exportData, DynamicGroup, Icon, emptyRegion, metadata], triggerFiles, dataFiles]) => {
      // assign core templates
      ExportData = exportData;
      DynamicGroupTemplate = DynamicGroup;
      IconTemplate = Icon;
      EmptyRegionTemplate = emptyRegion;
      MetaData = metadata;

      // build two lists of fetch-and-assign promises
      const triggerFetches = triggerFiles.map((fileName) =>
        fetch(`templates/triggers/${fileName}`)
          .then((r) => r.json())
          .then((json) => {
            const key = fileName.replace(/\.json$/, "");
            Triggers[key] = json;
          })
      );

      const dataFetches = dataFiles.map((fileName) =>
        fetch(`templates/data/${fileName}`)
          .then((r) => r.json())
          .then((json) => {
            const key = fileName.replace(/\.json$/, "");
            Data[key] = json;
          })
      );

      // 3) wait for *all* of them
      return Promise.all([...triggerFetches, ...dataFetches]);
    }
  )
  .catch((err) => console.error("Error loading templates or triggers:", err));

function addAuraToGroup(group, aura) {
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
}

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
  addAuraToGroup(group, aura);

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

function setTriggerUnit(trigger, unit) {
  if (Data.units[unit]) {
    trigger.trigger.unit = Data.units[unit];
  } else {
    console.error(`Unit "${unit}" not found in Data.units`);
  }
  return trigger;
}

function setAuthorOptions(aura, authorOptions) {
  if (authorOptions) {
    aura.authorOptions = authorOptions;
  } else {
    console.error(`Author options for aura "${aura}" can't be nil`);
  }
  return aura;
}

function setCustomTrigger(trigger, custom, events, duration){
  if(trigger.trigger.type !== "custom") {
    console.error(`Custom trigger could not be set for trigger "${trigger}" type "${trigger.trigger.type}" not supported`);
  }
  trigger.trigger.custom = custom;
  if(duration){
    trigger.trigger.custom_hide = "timed";
    trigger.trigger.duration = String(duration);
  }
  if(events){
    trigger.trigger.events = events;
  }
  return trigger;
}

function setAuraId(aura, idString) {
  if (idString) {
    aura.id = idString;
  } else {
    console.error(`ID for aura "${aura}" can't be nil`);
  }
  return aura;
}

function setAuraUid(aura, idString) {
  if (idString) {
    aura.uid = idString;
  } else {
    console.error(`UID for aura "${aura}" can't be nil`);
  }
  return aura;
}

function setAuraWidth(aura, width) {
  aura.width = Number(width)
}

function setAuraHeight(aura, height) {
  aura.height = Number(height)
}

function setSpellIds(trigger, spellIds, useExactSpellId = false) {
  if (trigger.trigger.type === "aura2") {
    if( useExactSpellId){
      trigger.trigger.auraspellids = spellIds;
      trigger.trigger.useExactSpellId = true
      trigger.trigger.useName = false
    }
    else{
      trigger.trigger.auranames = spellIds;
      trigger.trigger.useName = true
    }
  } else {
    console.error(
      `SpellIds could not be set for trigger "${trigger}" type "${trigger.trigger.type}" not supported`
    );
  }
  return trigger;
}

function setTriggerIncludesPets(trigger, includePets) {
  trigger.trigger.use_includePets = includePets;
  trigger.trigger.includePets = "PlayersAndPets";
}

function setAnchorPerFrame(aura, anchorFrame) {
  aura.anchorPerUnit = anchorFrame;
  aura.useAnchorPerUnit = true;
}


function setLoadInBossfight(aura, inBossfight) {
  if (inBossfight === undefined) return;
  aura.load.use_encounter = inBossfight
}


function addSpecId(trigger, specId) {
  if (
    trigger.trigger.type === "unit" &&
    trigger.trigger.event === "Unit Characteristics"
  ) {
    trigger.trigger.specId.multi[specId] = true;
  } 
  else if (trigger.trigger.type === "aura2") {
    trigger.trigger.actualSpec = trigger.trigger.actualSpec || {};
    trigger.trigger.actualSpec[specId] = true;
    trigger.trigger.useActualSpec = true;
  }
  else {
    console.error(
      `SpecId could not be set for trigger "${trigger}" type "${trigger.trigger.type}" not supported`
    );
  }
  return trigger;
}

function setDeBuffType(trigger, type) {
  if (Data.debuffType[type]) {
    trigger.trigger.debuffType = Data.debuffType[type];
  } else {
    console.error(`Type "${type}" not found in Data.debuffType`);
  }
  return trigger;
}

function setTriggerMode(aura, mode, customTriggerLogic) {
  aura.triggers.disjunctive = mode;
  if (mode === "custom") {
    aura.triggers.customTriggerLogic = customTriggerLogic;
  }
  aura.triggers.activeTriggerMode = -10;
  return aura;
}

function setActionsOnShowCustom(aura, custom){
  aura.actions.start.do_custom= true;
  aura.actions.start.custom= custom;
  return aura;
}

function setActionsOnInitCustom(aura, custom){
  aura.actions.init.do_custom= true;
  aura.actions.init.custom= custom;
  return aura;
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
  const parts = buildStr.split("."); // ["11","1","0","60257"] 

  // Destructure only the first three segments; ignore anything after the third dot
  const [major, minor, patch] = parts;

  // Convert to numbers and compute TOC version: major*10000 + minor*100 + patch
  const tocversion =
    parseInt(major, 10) * 10000 +
    parseInt(minor, 10) * 100 +
    parseInt(patch, 10); // e.g. 11*10000 + 1*100 + 0 = 110100 

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
