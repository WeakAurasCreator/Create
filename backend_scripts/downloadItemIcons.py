import os
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load items
with open('data/equippable-items.json', 'r') as f:
    items = json.load(f)

# Unique icon names
icons = {item.get('icon') for item in items if item.get('icon')}

# Ensure output directory exists
os.makedirs('data/icons', exist_ok=True)

# Download function
def download_icon(icon_name):
    url = f'https://render.worldofwarcraft.com/eu/icons/56/{icon_name}.jpg'
    dest = f'data/icons/{icon_name}.jpg'
    try:
        urllib.request.urlretrieve(url, dest)
        return f"Downloaded: {icon_name}"
    except urllib.error.HTTPError as e:
        return f"Failed ({e.code}) for {icon_name}"
    except Exception as e:
        return f"Error for {icon_name}: {e}"

# Use thread pool to parallelize downloads
with ThreadPoolExecutor(max_workers=100) as executor:
    futures = {executor.submit(download_icon, icon): icon for icon in icons}
    for future in as_completed(futures):
        print(future.result())