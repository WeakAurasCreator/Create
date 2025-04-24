// Fetch and render DPS delta per spec for selected target count
let piAura, piValues, dpsLookup = {};
const piAuraFetches = [
  fetch("/templates/piAura.json").then(r => r.json()),
  fetch("/data/pi_values.json").then(r => r.json()),
]
Promise.all(piAuraFetches)
  .then(([pi_aura, pi_values]) => {
    piAura             = pi_aura;
    piValues           = pi_values;
    setupPiData(piValues);
    dpsLookup = piValues.reduce((map, row) => {
      const t = row.targets;
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(row);
      return map;
    }, new Map());
    
    // sort each array in the Map
    for (const bucket of dpsLookup.values()) {
      bucket.sort((a, b) => b.dps_with_pi - a.dps_with_pi);
    }

    
  })
  .catch(err => console.error("Error loading templates or triggers:", err));


  window.copyToClipboard = copyToClipboard;

function setupPiData(data){
  const targetSelect = document.getElementById('targetSelect');
    const ctx = document.getElementById('dpsChart').getContext('2d');
    let chart;

    // Get unique target counts and populate dropdown
    const targets = [...new Set(data.map(entry => entry.targets))].sort((a,b) => a - b);
    targets.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.text = `${t} Target${t > 1 ? 's' : ''}`;
      targetSelect.appendChild(opt);
    });

    // Render chart for selected target count
    function renderChart(targetCount) {
      // Filter entries for this target count
      const entries = data.filter(e => e.targets === targetCount);

      // Map to specs and absolute DPS delta; treat negatives as zero
      const specGains = entries.map(e => ({
        spec: `${e.class} - ${e.spec}`,
        gain: e.dps_delta > 0 ? e.dps_delta : 0
      }));

      // Sort descending by gain
      specGains.sort((a, b) => b.gain - a.gain);

      const labels = specGains.map(e => e.spec);
      const values = specGains.map(e => e.gain);
      const colors = values.map(v => v > 0 ? 'rgba(54, 162, 235, 0.7)' : 'rgba(200,200,200,0.7)');

      // If chart already exists, destroy before creating
      if (chart) chart.destroy();

      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Absolute DPS Gain',
            data: values,
            backgroundColor: colors,
            borderColor: colors.map(c => c.replace('0.7','1')),
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',        // Horizontal bars
          scales: {
            x: {
              beginAtZero: true,
              title: { display: true, text: 'DPS Gain' }
            },
            y: {
              title: { display: true, text: 'Spec' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => ctx.parsed.x > 0
                  ? `${ctx.formattedValue}`
                  : 'Non-significant'
              }
            }
          },
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }

    // Initial render and on-change handler
    renderChart(targets[0]);
    targetSelect.addEventListener('change', (e) => {
      renderChart(Number(e.target.value));
      document.getElementById("output").value = "";
    });
}



function generatePiAura(){
  let group = createGroupToExport("PiGroup");


  const targetSelect = document.getElementById('targetSelect');
  
  const targetArray = dpsLookup.get(Number(targetSelect.value));
  for( key in targetArray){
    spec = targetArray[key]
    console.log(spec)
    console.log(Object.keys(spec).length)
    let spellIds = {};
    let idx = 1;
    if(Object.keys(spec).length !== 0){
      for (const [key, val] of Object.entries(spec.pi_dep_spell_ids)) {
        if (val) {
          spellIds[idx++] = val.toString();
        }
      }
    }
    if(Object.keys(spellIds).length === 0)continue;
    console.log(spellIds)
    let aura = JSON.parse(JSON.stringify(piAura)); // get a copy of the Pi Template
    setAuraId(aura, `${spec.class} - ${spec.spec} [${spec.targets}]`); // set the ID to spec
    setAuraUid(aura,`WACreator_PI_${spec.class}_${spec.spec}_${spec.targets}`); // set the UID to class + spec + targets

    let buffTrigger = JSON.parse(JSON.stringify(Triggers.buff)); // get a copy of the buff Trigger Template
    setSpellIds(buffTrigger,spellIds);
    setTriggerUnit(buffTrigger, "Group");
    setDeBuffType(buffTrigger, "buff");
    addTrigger(aura, buffTrigger);

    let piCooldownTrigger = JSON.parse(JSON.stringify(Triggers.cooldown)); // get a copy of the pi cooldown Trigger Template
    addTrigger(aura, piCooldownTrigger);
    if( key !== "0"){ // skip adding higher priority specs for first spec
      let specTrigger = JSON.parse(JSON.stringify(Triggers.unit_characteristics)); // get a copy of the spec Trigger Template
      // add all higher priority specs to ignore list
      for( childkey in targetArray){
        if (Number(childkey) >= Number(key)) {
          break;
        }
        addSpecId(specTrigger, targetArray[childkey].specId);
      }
      addTrigger(aura, specTrigger);
      // set trigger mode
      setTriggerMode(aura, "custom", "function(t) return t[1] and t[2] and not t[3] end")
    }
    // add aura to group
    console.log(aura)
    addAuraToGroup(group, aura);

  }


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