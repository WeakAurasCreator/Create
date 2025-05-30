import os
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load talents
with open('data/talents/talents.json', 'r') as f:
    talents = json.load(f)

# Collect all atlasMemberName values recursively
def collect_atlas_names(obj):
    atlas_names = set()
    if isinstance(obj, dict):
        if 'atlasMemberName' in obj:
            atlas_names.add(obj['atlasMemberName'])
        for v in obj.values():
            atlas_names.update(collect_atlas_names(v))
    elif isinstance(obj, list):
        for item in obj:
            atlas_names.update(collect_atlas_names(item))
    return atlas_names

atlas_names = collect_atlas_names(talents)

# Ensure output directory exists
os.makedirs('data/icons', exist_ok=True)

# Download function
def download_icon(name):
    url = f'https://www.raidbots.com/static/images/TalentFrame/orig/elements/{name}.png'
    dest = f'data/icons/{name}.png'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
            out_file.write(response.read())
        return f"Downloaded: {name}"
    except urllib.error.HTTPError as e:
        return f"Failed ({e.code}) for {name}"
    except Exception as e:
        return f"Error for {name}: {e}"

# Parallel download
with ThreadPoolExecutor(max_workers=30) as executor:
    futures = {executor.submit(download_icon, name): name for name in atlas_names}
    for future in as_completed(futures):
        print(future.result())