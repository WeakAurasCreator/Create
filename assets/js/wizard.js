// wizard.js
(() => {
    let schema, allSteps = [], visibleSteps = [], sections = {};
    let form = {}, currentVisibleIndex = 0;
  
    const mainStepper = document.getElementById('main-stepper');
    const subStepper  = document.getElementById('sub-stepper');
    const formContainer = document.getElementById('form-container');
    const btnBack  = document.getElementById('btn-back');
    const btnNext  = document.getElementById('btn-next');
    const btnFinish= document.getElementById('btn-finish');
  
    // 1) Fetch schema
    fetch('assets/json/wizard.json')
      .then(r => r.json())
      .then(json => {
        schema = json;
        initForm();
        buildAllSteps();
        groupSections();
        renderWizard();
        attachNav();
      })
      .catch(err => console.error('Schema load failed:', err));
  
    // Initialize form model
    function initForm() {
      schema.steps.forEach(s => s.fields.forEach(f => {
        form[f.name] = (f.type==='select'||f.type==='dropdown')?'':
                       (f.type==='multiselect'||f.type==='checkbox')?[]:'';
      }));
    }
  
    // Flat list of all steps with index
    function buildAllSteps() {
      allSteps = schema.steps.map((s,i) => ({ ...s, index: i }));
    }
  
    // Group into { sectionName: [step,…] }
    function groupSections() {
      sections = allSteps.reduce((acc, step) => {
        acc[step.section] = acc[step.section]||[];
        acc[step.section].push(step);
        return acc;
      }, {});
    }
  
    // Evaluate visibleIf expression
    function evalVisible(step) {
      return step.visibleIf
        ? Function('form',`return ${step.visibleIf}`)(form)
        : true;
    }
  
    // Update flat visibleSteps
    function updateVisible() {
      visibleSteps = allSteps.filter(s => evalVisible(s));
    }
  
    // Render both steppers + form + nav
    function renderWizard() {
      updateVisible();
      // Determine which main section holds current step
      const overallIdx = visibleSteps[currentVisibleIndex].index;
      const mainEntries = Object.entries(sections);
      const mainIndex = mainEntries.findIndex(([,arr]) =>
        arr.some(s=>s.index===overallIdx)  
      );
  
      // Render main sections
      mainStepper.innerHTML = mainEntries.map(([sec],i) => {
        const cls = i<mainIndex?'completed':i===mainIndex?'current':'';
        return `<div class="step-circle ${cls}" data-section="${sec}">${sec}</div>`;
      }).join('');
      mainStepper.addEventListener('click', e => {               // listen for clicks 
        const pill = e.target.closest('.step-circle');           // find the clicked pill
        if (!pill) return;
        const secName = pill.dataset.section;                    // read data-section 
        // find first visibleSteps index in that section
        const target = visibleSteps.findIndex(s => s.section === secName); // findIndex()
        if (target >= 0) {
          currentVisibleIndex = target;
          renderWizard();                                         // re-render wizard at new step
        }
      });
  
      // Render sub‑steps of active section
      const subs = mainEntries[mainIndex][1];
      subStepper.innerHTML = subs.map((s,j) => {
        const pos = visibleSteps.findIndex(v=>v.index===s.index);
        const cls = pos<currentVisibleIndex?'completed':pos===currentVisibleIndex?'current':'';
        return `<div class="step-circle ${cls}">${j+1}</div>`;
      }).join('');
  
      renderFields();
      updateNav();
    }
  
    // Render form fields for current visible step
    function renderFields() {
      const step = visibleSteps[currentVisibleIndex];
      let html = `<h5>${step.label}</h5>`;
      if(step.description) html += `<p class="text-muted">${step.description}</p>`;
      step.fields.forEach(f => {
        html += `<div class="mb-3"><label class="form-label">${f.label}</label>`;
        if(f.type==='input')
          html += `<input name="${f.name}" class="form-control" value="${form[f.name]||''}"/>`;
        else if(f.type==='textarea')
          html += `<textarea name="${f.name}" class="form-control" rows="3">${form[f.name]||''}</textarea>`;
        else if(f.type==='dropdown')
          html += `<select name="${f.name}" class="form-select"><option value="">Bitte wählen…</option>`
                + f.options.map(o=>`<option value="${o.value}"${form[f.name]===o.value?' selected':''}>${o.label}</option>`).join('')
                + `</select>`;
        else   // select & multiselect as checkboxes
          f.options.forEach(o=>{
            const chk = form[f.name].includes(o.value)?'checked':'';
            html += `<div class="form-check"><input class="form-check-input" type="checkbox" name="${f.name}" value="${o.value}" ${chk}>`
                  + `<label class="form-check-label">${o.label}</label></div>`;
          });
        html += `</div>`;
      });
      formContainer.innerHTML = html;
  
      // wire change events
      formContainer.querySelectorAll('[name]').forEach(el=>{
        el.addEventListener('change',()=>{
          if(el.type==='checkbox'){
            const arr = form[el.name];
            if(el.checked) arr.push(el.value);
            else form[el.name] = arr.filter(v=>v!==el.value);
          } else form[el.name] = el.value;
          renderWizard();
        });
      });
    }
  
    // Update nav buttons
    function updateNav() {
      btnBack.disabled = currentVisibleIndex===0;
      btnNext.classList.toggle('d-none', currentVisibleIndex===visibleSteps.length-1);
      btnFinish.classList.toggle('d-none', currentVisibleIndex!==visibleSteps.length-1);
    }
  
    // Attach Next/Back/Finish handlers
    function attachNav() {
      btnNext.onclick = ()=>{ if(currentVisibleIndex<visibleSteps.length-1) currentVisibleIndex++, renderWizard(); };
      btnBack.onclick = ()=>{ if(currentVisibleIndex>0) currentVisibleIndex--, renderWizard(); };
      btnFinish.onclick = ()=>{
        const blob = new Blob([JSON.stringify(form,null,2)],{type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download='wizard-result.json'; a.click();
        URL.revokeObjectURL(url);
      };
    }
  })();
  