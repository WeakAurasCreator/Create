let encountersByInstance;

import tiers from '../../data/JournalTier.json';
import tierToInstances from '../../data/JournalTierXInstance.json';
import instances from '../../data/JournalInstance.json';
import encounterGroups from '../../data/JournalEncounter.json';
import { encode } from '/assets/js/encode.js'; 
import * as WA from '/assets/js/weakauras-core.js';

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

function populateEncounterDropdown(
  tiers,
  tierToInstances,
  instances,
  encounterGroups
) {
  const $sel = $("#encounterPicker");
  const select = document.getElementById("encounterPicker");
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
  let group = WA.createGroupToExport("TestGroup");
  let aura = JSON.parse(JSON.stringify(WA.IconTemplate)); // get a copy of the Icon Template

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
  let trigger = JSON.parse(JSON.stringify(WA.Triggers.encounter)); // get a copy of the encounterTime Trigger Template
  trigger.duration = encounterTime;
  WA.addTrigger(aura, trigger);

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
  WA.addAura(group, aura);

  // Encode
  let encodedString = encode(group);
  // Output
  document.getElementById("encounterOutput").value = encodedString;
  document.getElementById("encounterCopyButton").disabled = false;
}


window.generateWeakAura = generateWeakAura;

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
