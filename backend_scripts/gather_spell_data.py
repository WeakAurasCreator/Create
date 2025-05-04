import csv
import json
import os
import asyncio
import aiohttp
import aiofiles

# URLs for CSV data sources
SPELL_CSV_URL = "https://wago.tools/db2/Spell/csv?product=wow"
SPELLMISC_CSV_URL = "https://wago.tools/db2/SpellMisc/csv?product=wow"
MANIFEST_CSV_URL = "https://wago.tools/db2/ManifestInterfaceData/csv?product=wow"

# Ensure necessary directories exist
os.makedirs("data/icons", exist_ok=True)
os.makedirs("data/spells", exist_ok=True)

# Set maximum number of concurrent file operations/tasks.
CONCURRENT_TASKS = 100

async def fetch_csv(session, url):
    """Download CSV data asynchronously and return as a list of lines."""
    async with session.get(url) as response:
        response.raise_for_status()
        text = await response.text()
        return text.splitlines()

async def download_image(session, spell_id, icon_filename, semaphore):
    """Download and save spell icon asynchronously using a semaphore."""
    url = f"https://render.worldofwarcraft.com/us/icons/56/{icon_filename}"
    icon_path = f"data/icons/{icon_filename}"
    
    async with semaphore:
        async with session.get(url) as response:
            if response.status == 200:
                async with aiofiles.open(icon_path, "wb") as img_file:
                    await img_file.write(await response.read())
                print(f"Saved icon for spell {spell_id}")
            else:
                print(f"Failed to download icon for spell {spell_id}")

async def handle_spell(session, semaphore, spell_id, spell_data, spellmisc, manifest):
    """Process a single spell: merge data, download icon, and save JSON."""
    # Merge spell data with SpellMisc data if available
    misc_data = spellmisc.get(spell_id, {})
    combined_data = {**spell_data, **misc_data}

    # Get SpellIconFileDataID from SpellMisc
    icon_file_id = misc_data.get("SpellIconFileDataID", "")
    icon_filename = None

    if icon_file_id and icon_file_id in manifest:
        manifest_data = manifest[icon_file_id]
        icon_filename = manifest_data.get("FileName", "").lower().replace("blp", "jpg")

    # Save spell JSON data asynchronously with a semaphore lock
    spell_json_path = f"data/spells/{spell_id}.json"
    async with semaphore:
        async with aiofiles.open(spell_json_path, "w") as spell_file:
            await spell_file.write(json.dumps(combined_data, indent=2))
    print(f"Saved data for spell {spell_id}")

    # Download the icon asynchronously if found
    if icon_filename:
        await download_image(session, spell_id, icon_filename, semaphore)

async def process_data():
    """Main function to fetch, process, and save spell data asynchronously."""
    semaphore = asyncio.Semaphore(CONCURRENT_TASKS)
    
    async with aiohttp.ClientSession() as session:
        # Fetch CSVs concurrently
        spell_csv, spellmisc_csv, manifest_csv = await asyncio.gather(
            fetch_csv(session, SPELL_CSV_URL),
            fetch_csv(session, SPELLMISC_CSV_URL),
            fetch_csv(session, MANIFEST_CSV_URL)
        )

        # Convert CSVs into dictionaries
        spell_reader = csv.DictReader(spell_csv)
        spells = {row["ID"]: row for row in spell_reader}

        spellmisc_reader = csv.DictReader(spellmisc_csv)
        spellmisc = {row["SpellID"]: row for row in spellmisc_reader}

        manifest_reader = csv.DictReader(manifest_csv)
        manifest = {row["ID"]: row for row in manifest_reader}

        # Save all spell IDs asynchronously
        all_spell_ids = list(spells.keys())
        async with aiofiles.open("all_Spell_Ids.json", "w") as f:
            await f.write(json.dumps(all_spell_ids, indent=2))
        print("Saved all_Spell_Ids.json")

        # Process spells in batches using the semaphore to limit concurrency.
        tasks = []
        for spell_id, spell_data in spells.items():
            tasks.append(handle_spell(session, semaphore, spell_id, spell_data, spellmisc, manifest))

        # Await all tasks; semaphore limits concurrent file I/O operations.
        await asyncio.gather(*tasks)

# Run the async script
asyncio.run(process_data())
