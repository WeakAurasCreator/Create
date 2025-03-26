#!/usr/bin/env python3
import csv
import json
import os
import requests

# URLs for the CSV data sources
SPELL_CSV_URL = "https://wago.tools/db2/Spell/csv?product=wow"
SPELLMISC_CSV_URL = "https://wago.tools/db2/SpellMisc/csv?product=wow"
MANIFEST_CSV_URL = "https://wago.tools/db2/ManifestInterfaceData/csv?product=wow"

# Ensure the output directories exist
os.makedirs("data/icons", exist_ok=True)
os.makedirs("data/spells", exist_ok=True)

def download_csv(url):
    """Download CSV data from the provided URL and return as a list of lines."""
    response = requests.get(url)
    response.raise_for_status()
    return response.text.splitlines()

# Download and parse the CSVs into dictionaries.
# 1. Spell CSV: key by "ID"
spell_lines = download_csv(SPELL_CSV_URL)
spell_reader = csv.DictReader(spell_lines)
spells = {row["ID"]: row for row in spell_reader}

# 2. SpellMisc CSV: key by "SpellID" so we can link it to spells
spellmisc_lines = download_csv(SPELLMISC_CSV_URL)
spellmisc_reader = csv.DictReader(spellmisc_lines)
spellmisc = {row["SpellID"]: row for row in spellmisc_reader}

# 3. ManifestInterfaceData CSV: key by "ID"
manifest_lines = download_csv(MANIFEST_CSV_URL)
manifest_reader = csv.DictReader(manifest_lines)
manifest = {row["ID"]: row for row in manifest_reader}

# Save a JSON list of all spell IDs (from Spell CSV)
all_spell_ids = list(spells.keys())
with open("all_Spell_Ids.json", "w") as f:
    json.dump(all_spell_ids, f, indent=2)
print("Saved all_Spell_Ids.json")

# Process each spell and merge with SpellMisc information.
for spell_id, spell_data in spells.items():
    # Retrieve additional data from SpellMisc if it exists
    misc_data = spellmisc.get(spell_id, {})

    # Combine both dictionaries; if keys conflict, misc_data will override spell_data.
    combined_data = {**spell_data, **misc_data}

    # Cross-reference SpellIconFileDataID from SpellMisc with ManifestInterfaceData.
    icon_file_id = misc_data.get("SpellIconFileDataID", "")
    if icon_file_id and icon_file_id in manifest:
        manifest_data = manifest[icon_file_id]
        # Get the file name, convert it to lowercase and replace the 'blp' extension with 'jpg'
        filename = manifest_data.get("FileName", "").lower().replace("blp", "jpg")
        # Construct the icon URL (here, the example uses the "56" size folder)
        icon_url = f"https://render.worldofwarcraft.com/us/icons/56/{filename}"
        # Download the image
        img_response = requests.get(icon_url)
        if img_response.status_code == 200:
            icon_path = os.path.join("data", "icons", f"{spell_id}.jpg")
            with open(icon_path, "wb") as img_file:
                img_file.write(img_response.content)
            print(f"Saved icon for spell {spell_id}")
        else:
            print(f"Failed to download icon for spell {spell_id} from {icon_url}. Reason {img_response.status_code}")
    else:
        print(f"No manifest data found for spell {spell_id} with SpellIconFileDataID: {icon_file_id}")

    # Save the combined spell data to a JSON file
    spell_json_path = os.path.join("data", "spells", f"{spell_id}.json")
    with open(spell_json_path, "w") as spell_file:
        json.dump(combined_data, spell_file, indent=2)
    print(f"Saved data for spell {spell_id}")

print("Data processing complete!")
