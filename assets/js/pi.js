
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
// Fetch and render DPS delta per spec for selected target count
let piValues,
  dpsLookup = {}, explanationLookup = {};
const piAuraFetches = [
  fetch("data/pi_values.json").then((r) => r.json()),
  fetch("data/piExplanations.json").then((r) => r.json()),
];
Promise.all(piAuraFetches)
  .then(([pi_values, pi_explanations]) => {

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
    gear : e.gear,
    spec_id: e.specId,
    gain: e.dps_delta > 0 ? e.dps_delta : 0,
    dps_no_pi: e.dps_no_pi,
    dps_with_pi: e.dps_with_pi,
    dps_delta: e.dps_delta,
    dps_pct_gain: e.dps_pct_gain,
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
        renderModal(meta);
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  });
  return chart;
}


function formatSuffix(number) {
  if (number >= 1e9)   return (number / 1e9).toFixed(2) + ' B';
  if (number >= 1e6)   return (number / 1e6).toFixed(2) + ' M';
  if (number >= 1e3)   return (number / 1e3).toFixed(2) + ' K';
  return Math.round(number).toLocaleString();
}

function renderModal(meta){
        const { targets, class: cls, spec, talents, gear, spec_id,
          dps_no_pi, dps_with_pi, dps_delta, dps_pct_gain } = meta;
        // Build URLs
        const base = 'https://weakaurascreator.github.io/Create/data/sims/final_sims';
        const path = `${cls}/${spec}/${cls}_${spec}_${targets}_`;
        const urlNoPi   = `${base}/${path}0.html`;
        const urlWithPi = `${base}/${path}1.html`;

        // DPS stats
          document.getElementById('dpsNoPiValue').textContent    = formatSuffix(dps_no_pi);
          document.getElementById('dpsWithPiValue').textContent  = formatSuffix(dps_with_pi);
          document.getElementById('dpsDeltaValue').textContent   = formatSuffix(dps_delta);
          document.getElementById('dpsPctGainValue').textContent = dps_pct_gain.toFixed(2);

        // Set links
        document.getElementById('simulation-header').textContent = `Details for ${targets} Target${targets > 1 ? 's' : ''}`;
        document.getElementById('reportNoPi').href   = urlNoPi;
        document.getElementById('reportWithPi').href = urlWithPi;
        let talentHolder = document.createElement('a');
        talentHolder.innerText = 'View Talents on Wowhead';
        talentHolder.href = 'https://www.wowhead.com/talent-calc/embed/blizzard/' + talents;
        document.getElementById('simReportTalents').replaceChildren(talentHolder);
        // dirty hack to render the wowhead tooltip by mousing over the link
        const mouseOverEvent = new MouseEvent('mouseover', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        
        talentHolder.dispatchEvent(mouseOverEvent);
        renderGear(gear,spec_id);

        updateArchonLinks(meta);
        window.location.hash = 'piSimModal';
        localStorage.setItem('piLastMeta', JSON.stringify(meta));
}

function updateArchonLinks(meta) {
          const { class: cls, spec, targets } = meta;
          // slugify class & spec
          const specSlug  = spec.toLowerCase();
          const classSlug = cls.toLowerCase();

          // decide URL based on target count
          let archonURL;
          if (targets === 1) {
            // —— single-target raid guide —— 
            // replace `<RAID_SLUG>` with your raid’s actual slug, e.g. "vault-of-the-incarnates"
            archonURL = `https://www.archon.gg/wow/builds/${specSlug}/${classSlug}/raid/overview/mythic/all-bosses`;
          } else {
            // —— multi-target (M+) guide ——
            archonURL = `https://www.archon.gg/wow/builds/${specSlug}/${classSlug}/mythic-plus/overview/high-keys/all-dungeons/this-week`;
          }

          // update both the logo link and the text link
          document.getElementById('archonLink')    .href = archonURL;
          document.getElementById('archonLinkText').href = archonURL;
        }

function renderGear(gear, spec_id){
        let gearHolder =  document.getElementById('simReportGear')
        gearHolder.replaceChildren(); // clear previous gear items
        for (const [key, item] of Object.entries(gear)) {
          let gearItem = document.createElement('a');
          gearItem.target = '_blank';
          gearItem.classList.add('gear-item');
          let gearIcon = document.createElement('img');
          gearIcon.src = item.icon
          gearItem.appendChild(gearIcon);
          
          
          let attributes = ""
          if (item.bonus_ids && item.bonus_ids.length > 0) {
            if (attributes.length > 0) {
              attributes += '&';
            }
            attributes += `bonus=${item.bonus_ids.join(':')}`;
          }
          if (item.gem_ids && item.gem_ids.length > 0) {
            if (attributes.length > 0) {
              attributes += '&';
            }
            attributes += `gems=${item.gem_ids.join(':')}`;
          }
          if (item.enchant_ids && item.enchant_ids.length > 0) {
            if (attributes.length > 0) {
              attributes += '&';
            }
            attributes += `ench=${item.enchant_ids.join(':')}`;
          }

          if (attributes.length > 0) {
            attributes += '&';
          }
          attributes += `spec=${spec_id}`;
          
          gearItem.href = `https://www.wowhead.com/item=${item.id}?${attributes}`;
          gearItem.setAttribute("data-wowhead", attributes);

          gearHolder.appendChild(gearItem);
          
          
        };
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

document.addEventListener('DOMContentLoaded', () => {
  // toggle advanced options
  const advToggle = document.getElementById('advancedToggle');
  const advSettings = document.getElementById('advancedSettings');
  advToggle.addEventListener('change', () => {
    advSettings.classList.toggle('d-none', !advToggle.checked);
  });


  if (window.location.hash === '#piSimModal') {
    const saved = localStorage.getItem('piLastMeta');
    if (saved) {
      try {
        renderModal(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to reload PI simulation data:', e);
      }
    }
    else{
      console.warn('No saved PI simulation data found.');
      window.location.hash = ''; // Clear hash if no data
    }
  }
});

window.addEventListener('hashchange', () => {
  if (window.location.hash !== '#piSimModal') {
    localStorage.removeItem('piLastMeta');
  }
});
