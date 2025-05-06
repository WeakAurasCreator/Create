import csv
import json
import os
import asyncio
import aiohttp
import aiofiles
import argparse
import time
import backoff
from aiohttp import ClientResponseError
import random

# URLs for CSV data sources
SPELL_CSV_URL = "https://wago.tools/db2/Spell/csv?product=wow"
SPELLMISC_CSV_URL = "https://wago.tools/db2/SpellMisc/csv?product=wow"
MANIFEST_CSV_URL = "https://wago.tools/db2/ManifestInterfaceData/csv?product=wow"

BLIZZARD_TOKEN_URL = "https://eu.battle.net/oauth/token"
API_SPELL_URL      = "https://eu.api.blizzard.com/data/wow/spell/{spell_id}"
NAMESPACE          = "static-eu"

_token_cache = {"token": None, "expires": 0}
all_Spell_Ids_file = "data/spells/all_Spell_Ids.json"
# Ensure necessary directories exist
os.makedirs("data/icons", exist_ok=True)
os.makedirs("data/spells", exist_ok=True)

# Set maximum number of concurrent file operations/tasks.
REQUESTS_PER_SECOND = 100
CONCURRENT_TASKS = REQUESTS_PER_SECOND
MAX_RETRIES = 5
# --- Thread-Safe Rate Limiter Implementation ---
class RateLimiter:
    def __init__(self, rate: float):
        """
        Initialize the rate limiter.
        
        Args:
            rate (float): Allowed number of requests per second.
        """
        self.rate = rate
        self.delay = 1.0 / rate           # Minimum delay between requests
        self.lock = asyncio.Lock()        # Protect shared state
        self.next_available = 0           # Timestamp when the next request is allowed

    async def acquire(self):
        """
        Wait until the next request slot is available.
        This method is thread-safe; even if multiple tasks call it concurrently,
        each will wait its proper amount of time.
        """
        async with self.lock:
            now = asyncio.get_event_loop().time()
            if now < self.next_available:
                wait_time = self.next_available - now
            else:
                wait_time = 0
            # Schedule the next available slot
            self.next_available = max(now, self.next_available) + self.delay
        if wait_time:
            await asyncio.sleep(wait_time)

# Create a global rate limiter instance
rate_limiter = RateLimiter(REQUESTS_PER_SECOND)


async def get_blizzard_token(session):
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires"] - 60:
        return _token_cache["token"]

    auth = aiohttp.BasicAuth(os.environ["BLIZZARD_CLIENT_ID"],
                             os.environ["BLIZZARD_CLIENT_SECRET"])
    async with session.post(BLIZZARD_TOKEN_URL,
                            auth=auth,
                            data={"grant_type": "client_credentials"}) as resp:
        resp.raise_for_status()
        j = await resp.json()
        _token_cache["token"]   = j["access_token"]
        _token_cache["expires"] = now + j["expires_in"]
        return _token_cache["token"]

async def fetch_data(session, url, headers,params, retries=MAX_RETRIES):
    """
    Fetch JSON data from the provided URL with retry logic.
    The function uses the rate limiter to ensure requests are spaced out
    and handles HTTP 429 responses by retrying.
    """
    for attempt in range(1, retries + 1):
        try:
            # Wait for our thread-safe rate limiter to allow a new request.
            await rate_limiter.acquire()
            async with session.get(url, params=params, headers=headers) as resp:
                if resp.status == 429:
                    # Too many requests: wait a bit before retrying.
                    if attempt < retries:
                        await asyncio.sleep(random.uniform(1, 10))
                        continue
                    else:
                        raise aiohttp.ClientResponseError(
                            status=resp.status,
                            request_info=resp.request_info,
                            history=resp.history,
                            message=f"Rate limit exceeded on final attempt for {url}"
                        )
                resp.raise_for_status()
                return await resp.json()
        except aiohttp.ClientResponseError as e:
            if e.status == 429 and attempt < retries:
                await asyncio.sleep(1)
                continue
            else:
                print(f"Error: {e}")
                raise
    raise Exception("Failed to fetch data after maximum retries")



@backoff.on_exception(backoff.expo, ClientResponseError, max_time=60,
                      giveup=lambda e: e.status not in (429, 500, 502, 503, 504))
async def fetch_blizzard_spell(session, spell_id, token):
    url = API_SPELL_URL.format(spell_id=spell_id)
    params = {"namespace": NAMESPACE}
    headers = {"Authorization": f"Bearer {token}"}
    return fetch_data(session, url, headers, params, retries=MAX_RETRIES)

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
    print(f"[INFO] Processing spell {spell_id}")
    misc_data = spellmisc.get(spell_id, {})
    combined_data = {**spell_data, **misc_data}
    token = await get_blizzard_token(session)
    try:
        blz = await fetch_blizzard_spell(session, spell_id, token)
        print(f"[INFO] Blizzard API success for {spell_id} found {blz}")
        combined_data["name_blz"]        = blz["name"]
        combined_data["description_blz"] = blz.get("description", {})
    except Exception as e:
        print(f"[WARN] Blizzard API failed for {spell_id}: {e}")

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
        async with aiofiles.open(all_Spell_Ids_file, "w") as f:
            await f.write(json.dumps(all_spell_ids, indent=2))
        print("Saved all_Spell_Ids.json")

        # Process spells in batches using the semaphore to limit concurrency.
        tasks = []
        for spell_id, spell_data in spells.items():
            tasks.append(handle_spell(session, semaphore, spell_id, spell_data, spellmisc, manifest))

        # Await all tasks; semaphore limits concurrent file I/O operations.
        await asyncio.gather(*tasks)

async def process_batch(batch_ids, spells, spellmisc, manifest):
    """Run handle_spell for one batch of IDs."""
    semaphore = asyncio.Semaphore(CONCURRENT_TASKS)
    async with aiohttp.ClientSession() as session:
        tasks = [
            handle_spell(session, semaphore, sid, spells[sid], spellmisc, manifest)
            for sid in batch_ids
        ]
        await asyncio.gather(*tasks)

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--batch-size",   type=int, required=True)
    return p.parse_args()
# Run the async script
async def main():
    args = parse_args()
    batch_size = args.batch_size
    now_ts     = int(time.time())

    # 1) Fetch the latest Spell CSV to discover ALL current IDs
    async with aiohttp.ClientSession() as s:
        spell_csv = await fetch_csv(s, SPELL_CSV_URL)
    csv_ids = [row["ID"] for row in csv.DictReader(spell_csv)]
    print("Fetched all IDs from Spell CSV")
    # 2) Load or init progress.json mapping id→last_processed_ts
    prog_path = "data/spells/progress.json"
    if os.path.exists(prog_path):
        with open(prog_path) as f:
            progress = json.load(f)
    else:
        progress = {}  # empty dict
    
    seen_ids = set(progress.keys())
    all_ids  = csv_ids  # current universe
    print("Loaded progress.json with", len(progress), "entries")
    # 3) Pick out brand-new IDs
    new_ids = [sid for sid in all_ids if sid not in seen_ids]
    print("Found", len(new_ids), "new IDs")
    # 4) For the ones we’ve seen, sort by oldest processed first
    old_ids = sorted(
        (sid for sid in all_ids if sid in seen_ids),
        key=lambda sid: progress[sid]
    )
    print("Found", len(old_ids), "old IDs")
    # 5) Build this run’s batch: up to batch_size
    batch = new_ids[:batch_size]
    if len(batch) < batch_size:
        batch += old_ids[: (batch_size - len(batch))]

    print(f"Total known IDs: {len(all_ids)}, new: {len(new_ids)}, batch: {len(batch)}")

    # 6) Fetch SpellMisc and Manifest once
    async with aiohttp.ClientSession() as s:
        spellmisc_csv, manifest_csv = await asyncio.gather(
            fetch_csv(s, SPELLMISC_CSV_URL),
            fetch_csv(s, MANIFEST_CSV_URL),
        )
    print("Fetched SpellMisc and Manifest CSVs")

    # build lookup dicts
    spells    = {row["ID"]: row for row in csv.DictReader(spell_csv)}
    spellmisc = {row["SpellID"]: row for row in csv.DictReader(spellmisc_csv)}
    manifest  = {row["ID"]: row for row in csv.DictReader(manifest_csv)}
    print("Converted CSVs into dictionaries")
    # 7) Process exactly this batch
    await process_batch(batch, spells, spellmisc, manifest)
    print("Processed batch of spells")
    # 8) Update progress timestamps for these IDs
    for sid in batch:
        progress[sid] = now_ts
    print("Updated progress timestamps for batch")
    # 9) Persist progress.json
    with open(prog_path, "w") as f:
        json.dump(progress, f, indent=2)
    print("Updated data/progress.json with", len(batch), "entries")

if __name__ == "__main__":
    asyncio.run(main())