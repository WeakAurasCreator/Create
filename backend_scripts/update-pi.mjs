import pako from 'pako';

async function main() {
  global.window = global;
  window.pako = pako;
  const piGen = await import('../assets/bundles/pi-generator.js');
  const { generatePiEncodedString } = piGen;

  // 4) Run the generator + update logic
  const importString = await generatePiEncodedString(
    Number(process.env.PI_TARGET_COUNT  || 1),
    process.env.PI_MODE             || 'dual',
    Number(process.env.PI_DUAL_BOSS_COUNT || 1),
    Number(process.env.PI_DUAL_TRASH_COUNT|| 5),
    Number(process.env.PI_ICON_SIZE   || 36),
    process.env.PI_ANCHOR_GROUP === 'true'
  );
  console.log(`Generated import string: ${importString}`);
  // Your existing Wago‐push logic:
  const WAGO_ID     = process.env.WAGO_ID;
  const TOKEN       = process.env.WAGO_TOKEN;
  const scanRes = await fetch('https://data.wago.io/import/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': TOKEN,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        importString: importString,
        type: 'WEAKAURA'
      })
    });

    const scanData = await scanRes.json();

  console.log('Scan response:', scanRes.status, scanData);

  if (!scanData.scan) {
    throw new Error(`Scan failed (status ${scanRes.status}): ${JSON.stringify(scanData)}`);
  }

 const updateRes = await fetch('https://data.wago.io/import/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': TOKEN,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        wagoID: WAGO_ID,
        type: 'WEAKAURA',
        scanID: scanData.scan,
        newVersion: process.env.NEW_VERSION,
        changelog: `Automated Data update for ${new Date().toLocaleDateString('en-GB')}`,
        changelogFormat: 'bbcode',
        cipherKey: ''
      })
    });

  const data = await updateRes.json();
  console.log('Update response:', data);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
