// Fetch and render DPS delta per spec for selected target count
let piAura,
  piValues,
  dpsLookup = {}, explanationLookup = {}, piChatAura= {};
const piAuraFetches = [
  fetch("templates/aura_types/piAura.json").then((r) => r.json()),
  fetch("templates/aura_types/piChatAura.json").then((r) => r.json()),
  fetch("data/pi_values.json").then((r) => r.json()),
  fetch("data/piExplanations.json").then((r) => r.json()),
];
Promise.all(piAuraFetches)
  .then(([pi_aura,pi_chat_aura, pi_values, pi_explanations]) => {
    piAura = pi_aura;
    piChatAura = pi_chat_aura;
    piValues = pi_values;
    explanationLookup = new Map(Object.entries(pi_explanations));
    setupPiData(piValues);
    setupWaTargetSelectors(piValues);
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
    renderAllExplanations()
  })
  .catch((err) => console.error("Error loading templates or triggers:", err));

// World of Warcraft class colors (hex) from https://warcraft.wiki.gg/wiki/Class_colors
const classColors = {
  DeathKnight: "#C41E3A",
  DemonHunter: "#A330C9",
  Druid: "#FF7C0A",
  Evoker: "#33937F",
  Hunter: "#AAD372",
  Mage: "#3FC7EB",
  Monk: "#00FF98",
  Paladin: "#F48CBA",
  Priest: "#FFFFFF",
  Rogue: "#FFF468",
  Shaman: "#0070DD",
  Warlock: "#8788EE",
  Warrior: "#C69B6D",
};

function setupWaTargetSelectors(data){
  const targetSelectOverall = document.getElementById("targetSelectOverall");
  const targetSelectBoss = document.getElementById("targetSelectBoss");
  const targetSelectTrash = document.getElementById("targetSelectTrash");

  // Get unique target counts and populate dropdown
  const targets = [...new Set(data.map((entry) => entry.targets))].sort(
    (a, b) => a - b
  );
  setupTargetSelector(targets, targetSelectOverall, targets[0].toString());
  setupTargetSelector(targets, targetSelectBoss,  targets[0].toString());
  setupTargetSelector(targets, targetSelectTrash,  targets[3].toString());
  targetSelectOverall.addEventListener("change", (e) => {
    document.getElementById("piOutput").value = "";
  });
  targetSelectBoss.addEventListener("change", (e) => {
    document.getElementById("piOutput").value = "";
  });
  targetSelectTrash.addEventListener("change", (e) => {
    document.getElementById("piOutput").value = "";
  });
}

function renderAllExplanations() {
  const container = document.getElementById('piAccordion');
  container.innerHTML = '';
  const entries = Array.from(explanationLookup.entries());

  entries.forEach(([key, text], idx) => {
    const [cls, spec] = key.split('_');
    const normalized = cls.toLowerCase(); 
    const classKey = Object.keys(classColors)
      .find(key => key.toLowerCase() === normalized);

    const color = classColors[classKey] || "#888888"; 


    const title = `${cls.charAt(0) + cls.slice(1).toLowerCase()} – ${spec.charAt(0) + spec.slice(1).toLowerCase()}`;
    const content = text.length > 1 ? text : 'No explanation available.';

    container.insertAdjacentHTML('beforeend', `
      <div class="accordion-item">
        <h2 class="accordion-header" id="heading${idx}">
          <button
            class="accordion-button collapsed"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#collapse${idx}"
            aria-expanded="false"
            aria-controls="collapse${idx}"
            style="color: ${color}!important;"
          >
            ${title}
          </button>
        </h2>
        <div
          id="collapse${idx}"
          class="accordion-collapse collapse"
          aria-labelledby="heading${idx}"
          data-bs-parent="#piAccordion"
        >
          <div class="accordion-body">${content}</div>
        </div>
      </div>
    `);
  });
}

document.getElementById('piFilter').addEventListener('input', e => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('#piAccordion .accordion-item').forEach(item => {
    const text = item.innerText.toLowerCase();
    item.style.display = text.includes(term) ? '' : 'none';
  });
});
const modeRadios  = document.querySelectorAll('input[name="mode"]');
const singleWrap  = document.getElementById("singleSelectWrapper");
const dualWrap    = document.getElementById("dualSelectWrapper");

function toggleModeUI(singleWrapper, dualWrapper) {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  singleWrapper.classList.toggle("d-none", mode === "dual");
  dualWrapper  .classList.toggle("d-none", mode === "single");
}
modeRadios.forEach(radio =>
  radio.addEventListener("change", () => {
    toggleModeUI(singleWrap, dualWrap);
    document.getElementById("piOutput").value = "";
  }
  )
);

function setupTargetSelector(targets, targetSelect, defaultValue) {
  targets.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.text = `${t} Target${t > 1 ? "s" : ""}`;
    targetSelect.appendChild(opt);
  });
  $("#"+targetSelect.id).selectpicker("refresh");
  if (!defaultValue) return;
  $("#"+targetSelect.id).selectpicker("val", defaultValue);
}

function renderChart(targetCount, data,ctx,chart) {
  // Filter entries for this target count
  const entries = data.filter((e) => e.targets === Number(targetCount));
  // Map to specs and absolute DPS delta; treat negatives as zero
  
  const specGains = entries.map((e) => ({
    class: e.class,
    spec: e.spec,
    targets: e.targets,
    talents: e.talents,
    gain: e.dps_delta > 0 ? e.dps_delta : 0,
  }));
  // Sort descending by gain
  specGains.sort((a, b) => b.gain - a.gain);

  const labels = specGains.map((e) => e.spec);
  const values = specGains.map((e) => e.gain);
  const colors = specGains.map((e) =>
    e.gain > 0
      ? classColors[e.class] // <-- pick exactly that class’s hex code
      : "rgba(200,200,200,0.7)"
  );

  // If chart already exists, destroy before creating
  if (chart) chart.destroy();
  Chart.defaults.color = "#FFFFFF";
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Absolute DPS Gain",
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y", // Horizontal bars
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "DPS Gain" },
          grid: {
            color: "#464545",
            tickColor: "#888888",
          },
        },
        y: {
          title: { display: false, text: "Spec" },
          grid: {
            color: "#464545",
            tickColor: "#888888",
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.parsed.x > 0 ? `${ctx.formattedValue}` : "Non-significant",
          },
        },
        legend: {
          display: false,
        },
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        // Only take the first bar clicked
        const bar = elements[0];
        const meta = specGains[bar.index]; 
        const targets = meta.targets;
        const cls   = meta.class;
        const spec  = meta.spec;
        const talents = meta.talents;
        // Build URLs
        const base = 'https://weakaurascreator.github.io/Create/data/sims/final_sims';
        const path = `${cls}/${spec}/${cls}_${spec}_${targets}_`;
        const urlNoPi   = `${base}/${path}0.html`;
        const urlWithPi = `${base}/${path}1.html`;
        // Set iframe srcs
        document.getElementById('reportNoPi').href   = urlNoPi;
        document.getElementById('reportWithPi').href = urlWithPi;
        let talentHolder = document.createElement('a');
        talentHolder.innerText = 'View Talents on Wowhead';
        talentHolder.href = 'https://www.wowhead.com/talent-calc/embed/blizzard/' + talents;
        document.getElementById('simReportTalents').replaceChildren(talentHolder);
        // Show modal
        const mouseOverEvent = new MouseEvent('mouseover', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        talentHolder.dispatchEvent(mouseOverEvent);

        window.location.hash = 'piSimModal';
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  });
  return chart;
}

function setupPiData(data ) {
  const ctx = document.getElementById("dpsChart").getContext("2d");
  let chart;
  const targetSelect = document.getElementById("targetSelect");

  // Get unique target counts and populate dropdown
  const targets = [...new Set(data.map((entry) => entry.targets))].sort(
    (a, b) => a - b
  );
  setupTargetSelector(targets, targetSelect, targets[0].toString());

  // Render chart for selected target count
  chart = renderChart(targets[0], data, ctx, chart);

  targetSelect.addEventListener("change", (e) => {
    chart = renderChart(Number(e.target.value),data, ctx, chart);
  });
}

function createPiAuraEntry(spec,spellIds, targetArray, loadInEncounter, iconSize){
  let aura = JSON.parse(JSON.stringify(piAura)); // get a copy of the Pi Template
  setAuraId(aura, `${spec.class} - ${spec.spec} [${spec.targets}]`); // set the ID to spec
  setAuraUid(aura, `WACreator_PI_${spec.class}_${spec.spec}_${spec.targets}`); // set the UID to class + spec + targets
  setLoadInBossfight(aura, loadInEncounter);
  setAuraWidth(aura, iconSize);
  setAuraHeight(aura, iconSize);

  let buffTrigger = JSON.parse(JSON.stringify(Triggers.buff)); // get a copy of the buff Trigger Template
  setSpellIds(buffTrigger, spellIds, true);
  setTriggerUnit(buffTrigger, "Group");
  setDeBuffType(buffTrigger, "buff");
  addSpecId(buffTrigger, spec.specId);
  addTrigger(aura, buffTrigger);
  setTriggerIncludesPets(buffTrigger, true);

  let piCooldownTrigger = JSON.parse(JSON.stringify(Triggers.cooldown)); // get a copy of the pi cooldown Trigger Template
  addTrigger(aura, piCooldownTrigger);
  if (key !== "0") {
    // skip adding higher priority specs for first spec
    let specTrigger = JSON.parse(
      JSON.stringify(Triggers.unit_characteristics)
    ); // get a copy of the spec Trigger Template
    // add all higher priority specs to ignore list
    for (childkey in targetArray) {
      if (Number(childkey) >= Number(key)) {
        break;
      }
      addSpecId(specTrigger, targetArray[childkey].specId);
    }
    addTrigger(aura, specTrigger);
    // set trigger mode
    setTriggerMode(
      aura,
      "custom",
      "function(t) return t[1] and t[2] and not t[3] end"
    );
  }
  return aura;
}



function generatePiAurasForTargetArray(targetArray,group, loadInEncounter, iconSize){
  
  for (key in targetArray) {
    spec = targetArray[key];
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
    let aura = createPiAuraEntry(spec, spellIds, targetArray, loadInEncounter, iconSize); // create a copy of the Pi Template
    // add aura to group
    addAuraToGroup(group, aura);
  }
}

function createPiChatAura() {
  let aura = JSON.parse(JSON.stringify(EmptyRegionTemplate)); // get a copy of the empty region Template
  setAuraId(aura, `PI Anouncer`); 
  setAuraUid(aura, `WACreator_PI_Anouncer`); 
  setActionsOnShowCustom(aura, piChatAura.actions.start.custom);
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
  
  setActionsOnInitCustom(aura,init)

  let eventTrigger = JSON.parse(JSON.stringify(Triggers.event)); // get a copy of the event Trigger Template
  setCustomTrigger(eventTrigger, piChatAura.triggers[0].trigger.custom_trigger, piChatAura.triggers[0].trigger.events, 10);
  addTrigger(aura, eventTrigger);
  setAuthorOptions(aura,piChatAura.authorOptions)
  
  return aura;
}

function generatePiAura() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const anchorGroup = document.getElementById('anchorGroupToggle').checked;
  const iconSize = document.getElementById('iconSizeSelect').value;

  let group = createGroupToExport("PiGroup");
  if (anchorGroup){
    setAnchorPerFrame(group.d, "UNITFRAME");
  }

  let piChatAura = createPiChatAura();
  addAuraToGroup(group, piChatAura);

  if(mode === "single"){
    const targetSelect = document.getElementById("targetSelectOverall");
    const targetArray = dpsLookup.get(Number(targetSelect.value));
    generatePiAurasForTargetArray(targetArray, group , undefined, iconSize)
  }
  else if (mode === "dual"){
    const targetSelectBoss = document.getElementById("targetSelectBoss");
    const targetArrayBoss = dpsLookup.get(Number(targetSelectBoss.value));
    generatePiAurasForTargetArray(targetArrayBoss, group, true, iconSize)
    const targetSelectTrash = document.getElementById("targetSelectTrash");
    const targetArrayTrash = dpsLookup.get(Number(targetSelectTrash.value));
    generatePiAurasForTargetArray(targetArrayTrash, group, false, iconSize)
  }
  else{
    console.error("Invalid mode selected. Please choose either 'single' or 'dual'.");
    return;
  }
  // Serialize
  let serializedAura = serialize(group);
  // Deflate
  let deflatedData = deflate(serializedAura);
  // Encode
  let encodedString = encode(deflatedData);
  // Output
  document.getElementById("piOutput").value = `!WA:1!${encodedString}`;
  document.getElementById("piCopyButton").disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  // toggle advanced options
  const advToggle = document.getElementById('advancedToggle');
  const advSettings = document.getElementById('advancedSettings');
  advToggle.addEventListener('change', () => {
    advSettings.classList.toggle('d-none', !advToggle.checked);
  });
});
