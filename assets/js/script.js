const encounterDropdown = document.getElementById('encounter');
 
 encounters.forEach(encounter => {
     let option = document.createElement('option');
     option.value = encounter.id;
     option.textContent = encounter.name;
     encounterDropdown.appendChild(option);
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
     let aura = textTemplate;
 
     const encounterTime = "24";
     const fontSize = document.getElementById('fontSize').value || "20";
     const font = document.getElementById('font').value || "Friz Quadrata TT";
     const encounterID = document.getElementById('encounter').value || "";
 
     //aura.d.triggers["1"].trigger.duration = encounterTime;
     //aura.d.fontSize = parseInt(fontSize, 10);
     //aura.d.font = font;
     //aura.d.load.encounterid = encounterID;
 
     // Serialize
     let serializedAura = serialize(aura);
     // Deflate
     let deflatedData = deflate(serializedAura);
     // Encode
     let encodedString = encode(deflatedData);
     // Output
     document.getElementById('output').value = `!WA:1!${encodedString}`;
     document.getElementById('copyButton').disabled = false;
 }
 window.generateWeakAura = generateWeakAura;
 
 function copyToClipboard() {
     const textarea = document.getElementById('output');
     textarea.select();
     document.execCommand('copy');
 
     const popup = document.getElementById('popupMessage');
     popup.style.display = 'block';
 
     setTimeout(() => {
         popup.style.display = 'none';
     }, 3000);
 }
 window.copyToClipboard = copyToClipboard;
 
 function handleTriggerChange() {
     const triggerValue = document.getElementById('trigger').value;
 
     if (triggerValue === 'encounterTime') {
         document.getElementById('encounterTimeField').style.display = 'block';
         document.getElementById('encounterField').style.display = 'block';
     } else {
         document.getElementById('encounterTimeField').style.display = 'none';
         document.getElementById('encounterField').style.display = 'none';
     }
 
     handleAuraTypeChange();
 }
 window.handleTriggerChange = handleTriggerChange;
 
 function handleAuraTypeChange() {
     const auraTypeValue = document.getElementById('auraType').value;
 
     if (auraTypeValue === 'Progress Bar' || auraTypeValue === 'Icon') {
         document.getElementById('sizeFields').style.display = 'block';
         document.getElementById('heightField').style.display = 'block';
         document.getElementById('fontSizeField').style.display = 'none';
     } else if (auraTypeValue === 'Text') {
         document.getElementById('sizeFields').style.display = 'none';
         document.getElementById('heightField').style.display = 'none';
         document.getElementById('fontSizeField').style.display = 'block';
     } else {
         document.getElementById('sizeFields').style.display = 'none';
         document.getElementById('heightField').style.display = 'none';
         document.getElementById('fontSizeField').style.display = 'none';
     }
 }
 
 document.getElementById('auraType').addEventListener('change', handleAuraTypeChange);