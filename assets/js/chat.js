(() => {
  const chatC = document.getElementById("chat-container");
  const inputA = document.getElementById("chat-input-area");

  let schema,
    mode,
    generalAnswers = {},
    auras = [],
    currentAura = {};
  let genIdx = 0,
    auraIdx = 0;
  let fonts = {},
    sounds = {};
  const sharedMediaData = {};
  const sharedMediaFetches = [
    fetch("assets/json/font.json")
      .then((r) => r.json())
      .then((json) => (sharedMediaData.font = json)),
    fetch("assets/json/sound.json")
      .then((r) => r.json())
      .then((json) => (sharedMediaData.sound = json)),
    // add more here as you add more shared-media JSONs
  ];
  // 1) Load JSON
  fetch("assets/json/wizard.json")
    .then((r) => r.json())
    .then((json) => {
      schema = json;
      // 1b) Fetch all shared‐media, then merge into schema.generalSteps
      return Promise.all(sharedMediaFetches);
    })
    .then(() => {
      // now kick off the wizard
      askMode();
    })
    .catch((err) => console.error("Error loading wizard or media:", err));

  // 2) Ask Single vs. Group
  function askMode() {
    bot("Single aura, or Dynamic Group?");
    inputA.innerHTML = `
        <div class="option-container">
          <button class="btn btn-outline-primary" id="opt-single">Single</button>
          <button class="btn btn-outline-primary" id="opt-group">Group</button>
        </div>`;
    document.getElementById("opt-single").onclick = () => selectMode("single");
    document.getElementById("opt-group").onclick = () => selectMode("group");
  }
  function selectMode(m) {
    user(m === "single" ? "Single Aura" : "Dynamic Group");
    mode = m;
    askGeneral();
  }

  // 3) General steps (once)
  function askGeneral() {
    if (genIdx >= schema.generalSteps.length) {
      return askAura(); // move on
    }
    const step = schema.generalSteps[genIdx++];
    askStep(step, (val, skipped) => {
      if (!skipped) {
        generalAnswers[step.name] = val;
      }
      askGeneral();
    });
  }

  // 4) Aura steps (loop)
  function askAura() {
    if (auraIdx >= schema.auraSteps.length) {
      // finished one aura
      auras.push({ ...currentAura });
      currentAura = {};
      auraIdx = 0;
      if (mode === "group") return askAddAnother();
      else return finish();
    }
    const step = schema.auraSteps[auraIdx++];
    askStep(step, (val, skipped) => {
      if (!skipped) {
        currentAura[step.name] = val;
      }
      askAura();
    });
  }

  // 5) “Add another?” for groups
  function askAddAnother() {
    bot("Add another aura to the group?");
    inputA.innerHTML = `
        <div class="option-container">
          <button class="btn btn-outline-primary" id="yes">Yes</button>
          <button class="btn btn-outline-secondary" id="no">No</button>
        </div>`;
    document.getElementById("yes").onclick = () => {
      user("Yes");
      askAura();
    };
    document.getElementById("no").onclick = () => {
      user("No");
      finish();
    };
  }

  // 6) Final output
  function finish() {
    bot("All set! Here's your config:");
    const pre = document.createElement("pre");
    pre.innerText = JSON.stringify(
      {
        mode,
        ...generalAnswers,
        auras,
      },
      null,
      2
    );
    chatC.appendChild(pre);

    // clear out old input area
    inputA.innerHTML = "";

    // add a Restart button
    const restart = document.createElement("button");
    restart.className = "btn btn-secondary mt-3";
    restart.innerText = "Restart Wizard";
    restart.onclick = resetChat;
    inputA.appendChild(restart);

    chatC.scrollTop = chatC.scrollHeight;
  }

  // ——— Helpers ———

  function askStep(step, cb) {
    if (step.visibleIf) {
      let visible = false;
      try {
        // for general steps, `currentAura` is unused; for aura steps it’s available
        visible = Function(
          "answers",
          "current",
          "return " + step.visibleIf
        )(generalAnswers, currentAura);
      } catch (err) {
        console.warn("visibleIf evaluation error on", step.name, err);
      }
      if (!visible) {
        // skip this question
        return cb(undefined, true);
      }
    }
    const hint = step.helpText;
    if (step.options_url_key) {
      // derive key ('font' from 'fonts.json')
      const data = [];
      generalAnswers.sharedmedia?.forEach((o) => {
        let optiondata = sharedMediaData[step.options_url_key]?.[o]?.values;
        if (optiondata) data.push(...optiondata); // only push existing sharedmedia options
      });

      step.options = data.map((o) => ({ label: o.name, value: o.value }));
    }
    // if there is a hint, render a little "!" that shows it on hover
    const labelHtml = hint
      ? `${
          step.label
        }<span class="info-icon" data-bs-toggle="tooltip" data-bs-placement="top" title="${hint.replace(
          /"/g,
          "&quot;"
        )}">!</span>
        ${step.description} `
      : step.label;
    bot(labelHtml);
    renderControl(step, cb);
  }

  function renderControl(step, cb) {
    inputA.innerHTML = "";

    const c = document.createElement("div");
    c.className = "option-container";

    if (step.type === "input" || step.type === "number") {
      const inp = document.createElement("input");
      inp.type = step.type === "number" ? "number" : "text";
      inp.className = "form-control mb-2";
      inp.placeholder = step.placeholder || "";
      c.append(inp);
      const btn = makeBtn(
        "Send",
        // cb:
        (raw) => cb(raw),
        // getVal:
        () => inp.value
      );
      c.append(btn);
    } else if (step.type === "dropdown") {
      const sel = document.createElement("select");
      sel.className = "form-select mb-2";
      if (step.allowEmpty) {
        let o = new Option("(skip)", "");
        sel.add(o);
      }
      step.options.forEach((o) => {
        let option = new Option(o.label, o.value);
        if (o.checked) {
          option.selected = true;
        }
        sel.add(option);
      });
      c.append(sel);
      const btn = makeBtn(
        "Choose",
        (raw) => cb(raw),
        () => sel.value
      );
      c.append(btn);
    } else if (step.type === "multiselect") {
      step.options.forEach((o) => {
        let chk = document.createElement("div");
        chk.className = "form-check";
        let checked = o.checked ? "checked" : "";
        let onclick = o.checked ? `onclick= "return false;"` : "";
        chk.innerHTML = `
            <input class="form-check-input" type="checkbox" id="opt-${o.value}" value="${o.value}" ${checked} ${onclick}>
            <label class="form-check-label" for="opt-${o.value}">${o.label}</label>`;
        c.append(chk);
      });
      const btn = makeBtn(
        "Choose",
        (raw) => cb(raw),
        () =>
          Array.from(c.querySelectorAll("input:checked")).map((i) => i.value)
      );
      c.append(btn);
    } else {
      /* textarea, etc. fallback to text input */
      const ta = document.createElement("textarea");
      ta.className = "form-control mb-2";
      c.append(ta);
      const btn = makeBtn(
        "Send",
        (raw) => cb(raw),
        () => ta.value
      );
      c.append(btn);
    }

    inputA.append(c);
    inputA.querySelector("input,select,textarea")?.focus();
  }

  function resetChat() {
    // reset all state
    mode = null;
    generalAnswers = {};
    auras = [];
    currentAura = {};
    genIdx = 0;
    auraIdx = 0;

    // wipe out the chat bubbles and inputs
    chatC.innerHTML = "";
    inputA.innerHTML = "";

    // restart from the beginning
    askMode();
  }
  window.resetChat = resetChat;
  /**
   * @param {string}   text    The button’s visible text (“Send”, “Choose”, etc.)
   * @param {Function} cb      Callback to run with the raw value
   * @param {Function} getVal  No‐arg fn that returns raw value (string or array)
   */
  function makeBtn(text, cb, getVal) {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.innerText = text;
    btn.onclick = () => {
      const raw = getVal();
      let echo;
      if (Array.isArray(raw)) {
        // array of strings → just join
        echo = raw.join(", ");
      } else {
        // single value
        echo = raw;
      }

      user(echo);

      cb(raw, false);
    };
    return btn;
  }

  function bot(txt) {
    const d = document.createElement("div");
    d.className = "msg bot";
    d.innerHTML = `<div class="bubble">${txt.replace(/\n/g, "<br>")}</div>`;
    chatC.append(d);
    chatC.scrollTop = chatC.scrollHeight;
  }

  function user(txt) {
    const d = document.createElement("div");
    d.className = "msg user";
    d.innerHTML = `<div class="bubble">${txt}</div>`;
    chatC.append(d);
    chatC.scrollTop = chatC.scrollHeight;
  }
})();
