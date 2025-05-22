import os
import re
import json
import shutil
import requests
import subprocess
from pathlib import Path
from collections import defaultdict, Counter
import datetime
import argparse
import glob
from typing import Optional
import time

# ──────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────
GITHUB_API  = "https://api.github.com/repos/simulationcraft/simc/contents/profiles"
RAW_BASE    = "https://raw.githubusercontent.com/simulationcraft/simc/master/profiles"
GRAPHQL_URL = "https://www.warcraftlogs.com/api/v2/client"
TOKEN_URL   = "https://www.warcraftlogs.com/oauth/token"
SIMC_CMD    = shutil.which("simc") or "simc"       # Assumes 'simc' is in PATH

OUT_JSON    = Path("data") / "pi_values.json"
CONFIG_PATH  = Path(__file__).parent / "piConfig.json"
SIM_PATH = Path("data", "sims")
PROFILE_PATH = Path(SIM_PATH, "profiles")
FINAL_SIM_PATH = Path(SIM_PATH, "final_sims")

SIM_PATH.mkdir(parents=True, exist_ok=True)
PROFILE_PATH.mkdir(parents=True, exist_ok=True)
FINAL_SIM_PATH.mkdir(parents=True, exist_ok=True)
TARGET_COUNTS = [1, 3, 5, 8, 15]

# Load manual slug → class/spec map
with open(CONFIG_PATH) as f:
    PROFILE_MAP = {k.lower(): v for k, v in json.load(f).items()}

with open(Path("data")/"talents"/"talents.json") as f:
    talents_data = json.load(f)

# Map each Raidbots entry.id to its tree index: 0=class, 1=spec, 2=hero
talent_tree_map: dict[int,int] = {}
for spec in talents_data:
    for node in spec.get("classNodes", []):
        for entry in node.get("entries", []):
            if entry == {}: 
                continue
            talent_tree_map[int(entry["id"])] = 0
    for node in spec.get("specNodes", []):
        for entry in node.get("entries", []):
            if entry == {}: 
                continue
            talent_tree_map[int(entry["id"])] = 1
    for node in spec.get("heroNodes", []):
        for entry in node.get("entries", []):
            if entry == {}: 
                continue
            talent_tree_map[int(entry["id"])] = 2


def request_with_backoff(
    method: str,
    url: str,
    *,
    headers: Optional[dict] = None,
    json: Optional[dict] = None,
    data: Optional[dict] = None,
    max_retries: int = 5,
    backoff_factor: float = 1.0
) -> requests.Response:
    """
    Wrap requests.request to catch 429 responses, honor Retry-After, and retry with exponential back-off.
    """
    headers = headers or {}
    for attempt in range(1, max_retries + 1):
        resp = requests.request(method, url, headers=headers, json=json, data=data)
        if resp.status_code != 429:
            return resp
        # On 429, determine how long to wait
        retry_after = resp.headers.get("Retry-After")
        if retry_after:
            wait = float(retry_after)
        else:
            wait = backoff_factor * (2 ** (attempt - 1))
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] 429 received; "
              f"retrying in {wait}s (attempt {attempt}/{max_retries})")
        time.sleep(wait)
    # Final attempt (will raise if still 429)
    return requests.request(method, url, headers=headers, json=json, data=data)

# ──────────────────────────────────────────────────────────
# Helpers: GitHub → Latest Tier Folder & Profile Fetch
# ──────────────────────────────────────────────────────────
def get_latest_tier_folder(token=None):
    headers = {"Authorization": f"token {token}"} if token else {}
    resp = requests.get(GITHUB_API, headers=headers)
    resp.raise_for_status()
    # filter out PreRaid* folders, pick lexicographically last
    tiers = [e["name"] for e in resp.json()
             if e["type"]=="dir" and not e["name"].lower().startswith("pre") and not e["name"] == "generators" and not e["name"] == "tests"]
    return sorted(tiers)[-1]

def fetch_profile_texts(tier_folder):
    """
    Returns dict of { filename: text } for every .simc in the tier folder.
    """
    resp = requests.get(f"{GITHUB_API}/{tier_folder}")
    resp.raise_for_status()
    entries = resp.json()
    profiles = {}
    for e in entries:
        name = e["name"]
        if not name.endswith(".simc"):
            continue
        raw_url = f"{RAW_BASE}/{tier_folder}/{name}"
        txt = requests.get(raw_url).text
        profiles[name] = txt
    return profiles

def inject_overrides(text: str, cls: str, spec: str, hero: str) -> str:
    """
    Replaces the existing 'talents=' line (if any) with:
      class_talents=…
      spec_talents=…
      hero_talents=…
    Inserts at the same location as the removed line.
    """
    # Create the new talent lines
    new_talent_lines = "\n".join([
        f"class_talents={cls}" if cls else "",
        f"spec_talents={spec}" if spec else "",
        f"hero_talents={hero}" if hero else ""
    ]).strip()

    # Find and replace the talents= line
    pattern = re.compile(r"(?m)^talents=.*$")
    if pattern.search(text):
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}]⚠️ Replacing talents= line")
        return pattern.sub(new_talent_lines, text)
    else:
        # Fallback: insert after 'spec=' line
        spec_match = re.search(r"(?m)^spec=.*$", text)
        if spec_match:
            insert_at = spec_match.end()
            print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}]⚠️ No talents= line found; inserting talents lines after spec= at {insert_at}")
            return (
                text[:insert_at] + "\n" + new_talent_lines + text[insert_at:]
            )
        else:
            # If no good spot, just prepend as last resort
            print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}]⚠️ No spec= line found; prepending talents lines")
            return new_talent_lines + "\n" + text


# ──────────────────────────────────────────────────────────
# Helpers: Warcraft Logs OAuth2 & Top-Talent Fetching
# ──────────────────────────────────────────────────────────
def get_wcl_token(client_id, client_secret):
    resp = requests.post(
        TOKEN_URL,
        data={"grant_type":"client_credentials"},
        auth=(client_id, client_secret)
    )
    resp.raise_for_status()
    return resp.json()["access_token"]

def fetch_current_tier_encounters(wcl_token: str) -> tuple[list[int], list[int]]:
    # manual override still possible:
    z = os.getenv("WCL_ZONE_ID")
    b = os.getenv("WCL_BOSS_ID")
    if z and b:
        return int(z), int(b)

    hdr = {"Authorization": f"Bearer {wcl_token}"}

    # 1) Get latest expansion
    exp_q = "query { worldData { expansions { id name } } }"
    r = request_with_backoff("post", GRAPHQL_URL, headers=hdr, json={"query": exp_q})
    r.raise_for_status()
    exps = r.json()["data"]["worldData"]["expansions"]
    latest_exp = max(exps, key=lambda e: e["id"])["id"]

    # 2) Fetch all zones in that expansion
    zone_q = """
    query ($expID: Int!) {
      worldData {
        expansion(id: $expID) {
          zones {
            id
            name
            difficulties { id name }
            encounters { id name }
          }
        }
      }
    }
    """
    r = request_with_backoff("post", GRAPHQL_URL, headers=hdr,
                            json={"query": zone_q, "variables": {"expID": latest_exp}})
    r.raise_for_status()
    all_zones = r.json()["data"]["worldData"]["expansion"]["zones"]
    raid_zones = [
      z for z in all_zones
      if any(d["id"] == 5 for d in z["difficulties"])
         and "complete raids" not in z["name"].lower()
    ]
    if not raid_zones:
        raise RuntimeError(f"No valid raid zones found in expansion {latest_exp}")

    raid_zone  = raid_zones[0]
    raid_ids = [enc["id"] for enc in raid_zone ["encounters"]]
    dungeon_zone = next(z for z in all_zones if z["id"] == raid_zone["id"] + 1)
    dungeon_ids = [enc["id"] for enc in dungeon_zone["encounters"]]
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Current raid: {raid_zone['name']} (ID={raid_zone['id']}) Current Dungeon Season: {dungeon_zone['name']} (ID={dungeon_zone['id']})")
    return raid_ids, dungeon_ids

def fetch_top_data(token: str, encIDs: list[int], className: str, specName: str) -> tuple[list[tuple[int,int]], dict[str,int]]:
    """
    Fetches top-100 rankings for each encounter, aggregates:
      1) talent builds (list of (talentID, points))
      2) gear (most-common item per slot)
    Returns (popular_build, top_gear_map).
    """
    query = """
    query TopData($encID: Int!, $class: String!, $spec: String!) {
      worldData {
        encounter(id: $encID) {
          characterRankings(
            className:        $class
            specName:         $spec
            leaderboard:     LogsOnly
            includeCombatantInfo: true
          ) 
        }
      }
    }
    """

    headers = {"Authorization": f"Bearer {token}"}
    all_builds: list[tuple[tuple[tuple[int,int],...], int]] = []
    slot_counters: dict[str, Counter[int]] = defaultdict(Counter)

    for encID in encIDs:
        variables = {"encID": encID, "class": className, "spec": specName}
        resp = request_with_backoff("post", GRAPHQL_URL, headers=headers, json={"query": query, "variables": variables})
        resp.raise_for_status()
        rankings = resp.json()["data"]["worldData"]["encounter"]["characterRankings"]["rankings"]
        for entry in rankings:
            # accumulate talents
            talents = tuple(sorted((t["talentID"], t["points"]) for t in entry["talents"]))
            total_pts = sum(p for _, p in talents)
            all_builds.append((talents, total_pts))

            # accumulate gear
            for g in entry.get("gear", []):
                slot_counters[g["slot"]][int(g["id"])] += 1

    # Determine most-popular full-build (as before)
    max_pts = max(total for _, total in all_builds)
    valid = [b for b, tot in all_builds if tot == max_pts]
    popular_build, _ = Counter(valid).most_common(1)[0]

    # Determine top gear per slot
    top_gear: dict[str,int] = {}
    for slot, cnt in slot_counters.items():
        if cnt:
            top_gear[slot] = cnt.most_common(1)[0][0]

    return popular_build, top_gear

def to_snake(name: str) -> str:
    """
    Convert a display name like "Pillar of Frost" or "Dark Transformation"
    into snake_case: "pillar_of_frost", "dark_transformation".
    """
    # Lowercase, strip any punctuation, then replace non-alphanum runs with underscores
    import re
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s

def inject_gear_overrides(text: str, gear_map: dict[str,int]) -> str:
    """
    Builds a 'gear=' override line from gear_map (slot=itemID) and
    replaces/inserts it into the profile.
    """
    # build a comma-separated list like "head=229253,neck=203128,..."
    gear_parts = [f"{slot}={item_id}" for slot, item_id in gear_map.items()]
    gear_line = "gear=" + ",".join(gear_parts)

    # replace existing gear= line if present
    pattern = re.compile(r"(?m)^gear=.*$")
    if pattern.search(text):
        return pattern.sub(gear_line, text)
    # otherwise insert after class/spec block
    insert_match = re.search(r"(?m)^(class=.*|spec=.*)$", text)
    if insert_match:
        insert_pos = insert_match.end()
        return text[:insert_pos] + "\n" + gear_line + text[insert_pos:]
    # fallback: prepend
    return gear_line + "\n" + text


def split_tree_overrides(pairs: list[tuple[int,int]]):
    class_pts, spec_pts, hero_pts = [], [], []
    for tid, pts in pairs:
        tree = talent_tree_map.get(tid, 3)
        if tree == 0:
            class_pts.append(f"{tid}:{pts}")
        elif tree == 1:
            spec_pts.append(f"{tid}:{pts}")
        elif tree ==2:
            hero_pts.append(f"{tid}:{pts}")
        else:
            print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}]⚠️ Unknown talent ID {tid} in {pairs}")
    return (
        "/".join(class_pts),
        "/".join(spec_pts),
        "/".join(hero_pts)
    )

def extract_external_buffs(profile_text: str) -> set[str]:
    """
    Scan each line that invokes an external buff, and extract every
    buff.NAME.up occurrence on that line.
    """
    deps: set[str] = set()
    # Go line by line (handles single- or multi-line APL equally well)
    for line in profile_text.splitlines():
        if "invoke_external_buff" not in line:
            continue
        # Grab all buff.foo_bar.up instances
        for name in re.findall(r"(?<!\!)buff\.([a-z0-9_]+)\.up", line, flags=re.IGNORECASE):
            deps.add(name.lower())
        # Grab all buff.foo_bar.remains> instances    
        for name in re.findall(r"(?<!\!)buff\.([a-z0-9_]+)\.remains>", line, flags=re.IGNORECASE):
            deps.add(name.lower())    
    return deps
# ──────────────────────────────────────────────────────────
# Helpers: Running SimC with/without PI & Parsing DPS
# ──────────────────────────────────────────────────────────
def run_sim_in_memory(profile_text, enable_pi, num_targets=1, character_class ="", character_spec=""):
    """
    Writes a temp file with (or without) PI override,
    runs simc, returns parsed DPS float.
    """
    sim_file_path = Path(PROFILE_PATH, f"{character_class}_{character_spec}")
    sim_file_path.mkdir(parents=True, exist_ok=True)
    sim_file = Path(sim_file_path, f"{num_targets}_{enable_pi}.json")
    json_file_path = Path(FINAL_SIM_PATH, f"{character_class}_{character_spec}")
    json_file_path.mkdir(parents=True, exist_ok=True)
    json_file = Path(json_file_path,f"{num_targets}_{enable_pi}.json")

    pi_flag = 1 if enable_pi else 0
    override = (
        "\n# Power Infusion override\n"
        f"external_buffs.pool=power_infusion:120:{pi_flag}\n"
    )
    override += "\n# Multi‑target override\n"
    for i in range(1, num_targets + 1):
        override += f"enemy=TrainingDummy{i}\n"
    sim_file.write_text(profile_text + override)
    cmd = [
        SIMC_CMD, str(sim_file),
        f"iterations={ITERATIONS}",
        f"threads={THREADS}",
        "log_spell_id=1",
        "report_details=1",
        f"json2={json_file}",
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        # report the full stderr and a bit of stdout so we know what went wrong
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] \n❌ SimC failed (exit {res.returncode}):\n")
        print(res.stderr)
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] \n--- simc stdout tail ---")
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}]\n".join(res.stdout.splitlines()[-10:]))
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] --- end stdout tail ---\n")
        raise RuntimeError(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] SimC exited {res.returncode}")
    
    m = re.search(
        r"(?:Damage per second:\s*|DPS=)\s*([\d,]+\.\d+)",
        res.stdout
    )
    if not m:
        # dump last 10 lines to help debug when parse fails
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] \n--- simc stdout tail ---")
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] \n".join(res.stdout.splitlines()[-10:]))
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] --- end stdout tail ---\n")
        raise RuntimeError(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Failed to parse DPS from simc output")
    # strip commas before float conversion
    dps_str = m.group(1).replace(",", "")

    data = json.loads(json_file.read_text())
    player = data["sim"]["players"][0]
    buffs_all = player.get("buffs", []) + player.get("buffs_constant", [])

    buff_map: dict[str,int] = {}
    for b in buffs_all:
        # Try the obvious fields first
        name = b.get("name")
        sid  = b.get("spell")

        # Fallback: some versions nest under "spell": { "id":…, "name":… }
        if sid is None and isinstance(b.get("spell"), dict):
            sid  = b["spell"].get("spell")
            name = name or b["spell"].get("name")

        # Only keep it if we have both name & ID
        if name and sid:
            buff_map[name] = sid

    reverse_buff_map: dict[str,int] = {}
    for display_name, sid in buff_map.items():
        snake = to_snake(display_name)
        reverse_buff_map[snake] = sid

    return float(dps_str), reverse_buff_map

def load_dps_and_buffs(path: Path) -> float:
    try:
        j = json.loads(path.read_text())
        player = j["sim"]["players"][0]
        cd = player.get("collected_data", {})
        dps = cd.get("dps", {}).get("mean")
        buffs_all = player.get("buffs", []) + player.get("buffs_constant", [])

        buff_map: dict[str,int] = {}
        for b in buffs_all:
            # Try the obvious fields first
            name = b.get("name")
            sid  = b.get("spell")

            # Fallback: some versions nest under "spell": { "id":…, "name":… }
            if sid is None and isinstance(b.get("spell"), dict):
                sid  = b["spell"].get("spell")
                name = name or b["spell"].get("name")

            # Only keep it if we have both name & ID
            if name and sid:
                buff_map[name] = sid

        reverse_buff_map: dict[str,int] = {}
        for display_name, sid in buff_map.items():
            snake = to_snake(display_name)
            reverse_buff_map[snake] = sid

        return float(dps), reverse_buff_map
    except Exception as e:
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] ⚠️ "
                f"Failed to load DPS/buffs from '{path}': {e}")
        return 1.0, {}

def merge_results():
    # find all sim JSON outputs
    sim_paths = glob.glob(str(FINAL_SIM_PATH / "**" / "**" / "*.json"), recursive=True)

    # organize by (class, spec, targets)
    runs: dict[tuple[str,str,int], dict[bool, Path]] = {}
    for p in map(Path, sim_paths):
        # p = data/sims/final_sims/<Class>_<Spec>/<targets>_<pi>.json
        cls, spec, targets_str, pi_str = p.stem.split("_")
        pi_flag = pi_str.lower() in ("1", "true")
        key = (cls, spec, int(targets_str))
        runs.setdefault(key, {})[pi_flag] = p
    results = []
    # reload PROFILE_MAP so we can look up backups
    with open(CONFIG_PATH) as f:
        profile_map = {k.lower(): v for k,v in json.load(f).items()}

    for (cls, spec, nt), pair in runs.items():
        if False not in pair or True not in pair:
            print(f"⚠️  incomplete runs for {cls} {spec} @ {nt} targets, skipping")
            continue

        

        d0,buffs = load_dps_and_buffs(pair[False])
        d1,buffs = load_dps_and_buffs(pair[True])
        print(d0, d1)
        delta = d1 - d0
        pct   = (delta / d0) * 100

        # extract buffs from the profile file used for the with-PI run
        prof_file = PROFILE_PATH / cls / spec / f"{cls}_{spec}_{nt}_{int(True)}.simc"
        try:
            dependencies = extract_external_buffs(prof_file.read_text())
        except Exception as e:
            print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] ⚠️ Failed to extract external buffs from {prof_file}: {e}")
            dependencies = set()
        print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] PI dependencies: {dependencies}")
        dep_ids = {}
        for buff in dependencies:
            sid = buffs.get(buff)
            if sid is None:
                print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}]⚠️ Could not resolve buff '{buff}'")
            dep_ids[buff] = sid

        valid_deps = {b: sid for b, sid in dep_ids.items() if sid is not None}

        if not valid_deps:
            # fallback to backup_SpellId
            # find the config entry whose classSlug/specSlug match
            backup = []
            for cfg in profile_map.values():
                if cfg["classSlug"]==cls and cfg["specSlug"]==spec:
                    backup = [int(x) for x in cfg.get("backup_SpellId",[])]
                    break
            valid_deps = {sid: sid for sid in backup}
        
        results.append({
            "class": cls,
            "spec": spec,
            "specId": next(v["specId"] for v in profile_map.values()
                           if v["classSlug"]==cls and v["specSlug"]==spec),
            "targets": nt,
            "dps_no_pi":    round(d0,2),
            "dps_with_pi":  round(d1,2),
            "dps_delta":    round(delta,2),
            "dps_pct_gain": round(pct,2),
            "pi_dep_spell_ids": valid_deps,
        })

    # write the merged array
    OUT_JSON.parent.mkdir(exist_ok=True)
    OUT_JSON.write_text(json.dumps(results, indent=2))
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] ✅ Wrote merged {len(results)} entries to {OUT_JSON}")

# ──────────────────────────────────────────────────────────
# Prepare vs Run-job
# ──────────────────────────────────────────────────────────
def prepare_matrix():
    gh = os.getenv("GITHUB_TOKEN")
    wcl_id = os.getenv("WCL_CLIENT_ID"); wcl_sec = os.getenv("WCL_CLIENT_SECRET")
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] fetching latest tier folder from GitHub...")
    tier = get_latest_tier_folder(gh)
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Latest tier folder: {tier}")
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] fetching profiles...")
    profs = fetch_profile_texts(tier)
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Found {len(profs)} profiles")

    # 2) WCL token & dynamic zone/boss
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] fetching WCL token...")
    wcl_token = get_wcl_token(wcl_id, wcl_sec)
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] fetching dynamic zone and boss...")
    raid_ids, dungeon_ids = fetch_current_tier_encounters(wcl_token)
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Raid IDs: {raid_ids}, Dungeon IDs: {dungeon_ids}")

    jobs = []
    for fname, text in profs.items():
        base = fname[:-5]
        slug = base[len(tier)+1:] if base.startswith(tier+"_") else base
        key = slug.lower()
        if key not in PROFILE_MAP: 
            print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] ⚠️  Skipping unknown slug {key}")
            continue
        cfg = PROFILE_MAP[key]
        cls = cfg["classSlug"]; spec = cfg["specSlug"]

        # fetch top talents & inject
        raid_build, raid_gear = fetch_top_data(wcl_token, raid_ids, cls, spec)
        dung_build, dung_gear = fetch_top_data(wcl_token, dungeon_ids, cls, spec)
        rcls, rspec, rhero = split_tree_overrides(raid_build)
        dcls, dspec, dhero = split_tree_overrides(dung_build)
        prof_raid = inject_overrides(text, rcls, rspec, rhero)
        prof_raid = inject_gear_overrides(prof_raid, raid_gear)

        prof_dung = inject_overrides(text, dcls, dspec, dhero)
        prof_dung = inject_gear_overrides(prof_dung, dung_gear)

        for nt in TARGET_COUNTS:
            prof = prof_raid if nt==1 else prof_dung
            for pi_flag in (False, True):
                fname = f"{cls}_{spec}_{nt}_{int(pi_flag)}.simc"
                #set pi 
                pi_block = f"\n# Power Infusion override\nexternal_buffs.pool=power_infusion:120:{int(pi_flag)}\n"
                tgt_block = "\n# Multi-target override\n"
                for i in range(1, nt + 1):
                    tgt_block += f"enemy=TrainingDummy{i}\n"
                full_profile = prof + pi_block + tgt_block

                simf = PROFILE_PATH / fname
                simf.write_text(full_profile)
                jobs.append({
                    "sim_file": str(simf),
                    "json_out": str(FINAL_SIM_PATH / fname.replace('.simc','.json')),
                    "html_out": str(FINAL_SIM_PATH / fname.replace('.simc','.html')),
                    "class": cls,
                    "spec": spec,
                    "targets": nt,
                    "pi": pi_flag
                })
    # write the matrix.json on disk
    matrix = { "include": jobs }
    with open("matrix.json", "w") as f:
        json.dump(matrix, f)
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] ✔️ Wrote {len(jobs)} jobs to matrix.json")
    print(jobs)



def run_job(args):

    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Running sim with args {args}")
    content = Path(args.sim_file).read_text()
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Running sim for file {content}")

    cmd = [
        SIMC_CMD,
        args.sim_file,
        f"target_error={args.precision}",
        f"iterations={args.iterations}",
        "threads=10",
        "log_spell_id=1",
        "report_details=1",
        f"json2={args.json_out}",
        f"html={args.html_out}"
    ]
    try:
        subprocess.run(cmd, check=True)
    except Exception as e:
        # log the failure
        print(f"WARNING: simc failed for {args.sim_file}: {e}")
        # ensure output directory exists
        out_path = Path(args.json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        # write an empty-but-valid JSON structure
        empty = {"error": "simc_failed", "profiles": [], "stats": {}}
        out_path.write_text(json.dumps(empty))
        return


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare or run single SimC job with PI matrix")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--prepare", action="store_true", help="Build profiles & emit matrix JSON")
    group.add_argument("--run-job", action="store_true", help="Run exactly one sim-job from matrix")
    group.add_argument("--merge-results", action="store_true", help="Merge all sim JSONs into data/pi_values.json")
    
    parser.add_argument("--sim-file",    help="Path to .simc file to run")
    parser.add_argument("--json-out",    help="Path to write SimC JSON output")
    parser.add_argument("--html-out",    help="Path to write SimC HTML output")
    parser.add_argument("--class",       dest="class_name", help="Class slug")
    parser.add_argument("--spec",        dest="spec_name",  help="Spec slug")
    parser.add_argument("--targets",     type=int, help="# of targets to simulate")
    parser.add_argument("--pi",          type=lambda v: v.lower() in ("1","true"), help="Enable Power Infusion")
    parser.add_argument("--precision",   type=float, default=0.1, help="Statistical precision (%)")
    parser.add_argument("--iterations",   type=int, default=0.1, help="# of iterations to run")

    args = parser.parse_args()
    if args.prepare:
        prepare_matrix()
    elif args.run_job:
        run_job(args)
    elif args.merge_results:
        merge_results()
