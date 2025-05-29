import { encode } from '/assets/js/encode.js'; 
import * as WA from '/assets/js/weakauras-core.js';
import piAura from '../../templates/aura_types/piAura.json';
import piChatAura from '../../templates/aura_types/piChatAura.json';
import piValues from '../../data/pi_values.json';


let dpsLookup = {};

dpsLookup = piValues.reduce((map, row) => {
    const t = row.targets;
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(row);
    return map;
}, new Map());

// sort each array in the Map
for (let bucket of dpsLookup.values()) {
    bucket.sort((a, b) => b.dps_delta - a.dps_delta);
}

/**
 * @param {{ piAura: object, piChatAura: object, piValues: Array}} templates
 * @param {{ targetCount: number, mode: 'single'|'dual', dualBossCount?: number, dualTrashCount?: number, iconSize: number }} opts
 * @returns {string} the final `!WA:1!...` import string
 */
export async function generatePiEncodedString(targetCount, mode, dualBossCount, dualTrashCount, iconSize, anchorGroup ) {

  const group = WA.createGroupToExport("PiGroup");
  if (anchorGroup){
    WA.setAnchorPerFrame(group.d, "UNITFRAME");
  }
  let piChatAura = createPiChatAura(dpsLookup);
  WA.addAuraToGroup(group, piChatAura);

  if (mode === 'single') {
    generatePiAurasForTargetArray(
      dpsLookup.get(targetCount),
      group,
      undefined,
      iconSize
    );
  } else {
    generatePiAurasForTargetArray(
      dpsLookup.get(dualBossCount),
      group,
      true,
      iconSize
    );
    generatePiAurasForTargetArray(
      dpsLookup.get(dualTrashCount),
      group,
      false,
      iconSize
    );
  }
  const encoded    = await encode(group,false);

  return encoded;
}



export function createPiAuraEntry(spec,spellIds, targetArray, loadInEncounter, iconSize, key){
  let aura = JSON.parse(JSON.stringify(piAura)); // get a copy of the Pi Template
  WA.setAuraId(aura, `${spec.class} - ${spec.spec} [${spec.targets}]`); // set the ID to spec
  WA.setAuraUid(aura, `WACreator_PI_${spec.class}_${spec.spec}_${spec.targets}`); // set the UID to class + spec + targets
  WA.setLoadInBossfight(aura, loadInEncounter);
  WA.setAuraWidth(aura, iconSize);
  WA.setAuraHeight(aura, iconSize);

  let buffTrigger = JSON.parse(JSON.stringify(WA.Triggers.buff)); // get a copy of the buff Trigger Template
  WA.setSpellIds(buffTrigger, spellIds, true);
  WA.setTriggerUnit(buffTrigger, "Group");
  WA.setDeBuffType(buffTrigger, "buff");
  WA.addSpecId(buffTrigger, spec.specId);
  WA.addTrigger(aura, buffTrigger);
  WA.setTriggerIncludesPets(buffTrigger, true);

  let piCooldownTrigger = JSON.parse(JSON.stringify(WA.Triggers.cooldown)); // get a copy of the pi cooldown Trigger Template
  WA.addTrigger(aura, piCooldownTrigger);
  if (key !== "0") {
    // skip adding higher priority specs for first spec
    let specTrigger = JSON.parse(
      JSON.stringify(WA.Triggers.unit_characteristics)
    ); // get a copy of the spec Trigger Template
    // add all higher priority specs to ignore list
    for (const childkey in targetArray) {
      if (Number(childkey) >= Number(key)) {
        break;
      }
      WA.addSpecId(specTrigger, targetArray[childkey].specId);
    }
    WA.addTrigger(aura, specTrigger);
    // set trigger mode
    WA.setTriggerMode(
      aura,
      "custom",
      "function(t) return t[1] and t[2] and not t[3] end"
    );
  }
  return aura;
}



export function generatePiAurasForTargetArray(targetArray, group, loadInEncounter, iconSize){
  
  for (const key in targetArray) {
    const spec = targetArray[key];
    let spellIds = {};
    let idx = 1;
    if (Object.keys(spec).length !== 0) {
      for (const [key, val] of Object.entries(spec.pi_dep_spell_ids)) {
        if (val) {
          spellIds[idx++] = val.toString();
        }
      }
    }
    if (Object.keys(spellIds).length === 0) continue;
    let aura = createPiAuraEntry(spec, spellIds, targetArray, loadInEncounter, iconSize, key); // create a copy of the Pi Template
    // add aura to group
    WA.addAuraToGroup(group, aura);
  }
}

export function createPiChatAura(dpsLookup) {
  let aura = JSON.parse(JSON.stringify(WA.EmptyRegionTemplate)); // get a copy of the empty region Template
  WA.setAuraId(aura, `PI Anouncer`); 
  WA.setAuraUid(aura, `WACreator_PI_Anouncer`); 
  WA.setActionsOnShowCustom(aura, piChatAura.actions.start.custom);
  let piList = '{';
  for (const [targetCount, entries] of dpsLookup) {
      piList += `[${targetCount}] = {`;
      for (const entry of entries) {
          piList += `[${entry.specId}] = { gain = ${entry.dps_delta > 0 ? Math.round(entry.dps_delta) : 0} },`;
      }
      piList += '},';
  }
  piList += '}';

  const updated = new Date().toLocaleString(undefined, {
  year:   'numeric',
  month:  'numeric',
  day:    'numeric',
  hour:   '2-digit',
  minute: '2-digit'
  });
  let init = `aura_env.piList=${piList} \naura_env.updated = \"${updated}" \n ${piChatAura.actions.init.custom}`
  
  WA.setActionsOnInitCustom(aura,init)

  let eventTrigger = JSON.parse(JSON.stringify(WA.Triggers.event)); // get a copy of the event Trigger Template
  WA.setCustomTrigger(eventTrigger, piChatAura.triggers[0].trigger.custom_trigger, piChatAura.triggers[0].trigger.events, 10);
  WA.addTrigger(aura, eventTrigger);
  WA.setAuthorOptions(aura,piChatAura.authorOptions)
  
  return aura;
}

export async function generatePiAura() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const anchorGroup = document.getElementById('anchorGroupToggle').checked;
  const iconSize = document.getElementById('iconSizeSelect').value;
  const targetCount = Number(document.getElementById("targetSelectOverall").value);
  const dualBossCount = Number(document.getElementById("targetSelectBoss").value);
  const dualTrashCount = Number(document.getElementById("targetSelectTrash").value);

  let output = await generatePiEncodedString(targetCount, mode, dualBossCount, dualTrashCount, iconSize, anchorGroup )
  // Output
  document.getElementById("piOutput").value = output;
  document.getElementById("piCopyButton").disabled = false;
}

window.generatePiAura = generatePiAura;