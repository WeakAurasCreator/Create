import os
import re
import json
import shutil
import requests
import subprocess
from pathlib import Path
from collections import defaultdict, Counter

# ──────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────
GITHUB_API  = "https://api.github.com/repos/simulationcraft/simc/contents/profiles"
RAW_BASE    = "https://raw.githubusercontent.com/simulationcraft/simc/master/profiles"
GRAPHQL_URL = "https://www.warcraftlogs.com/api/v2/client"
TOKEN_URL   = "https://www.warcraftlogs.com/oauth/token"
SIMC_CMD    = shutil.which("simc") or "simc"       # Assumes 'simc' is in PATH
ITERATIONS  = 15000
THREADS     = 4
REGION      = "EU"
OUT_JSON    = Path("data") / "pi_values.json"
CONFIG_PATH  = Path(__file__).parent / "piConfig.json"
TARGET_COUNTS = [1, 3, 5, 8, 15]

# Load manual slug → class/spec map
with open(CONFIG_PATH) as f:
    PROFILE_MAP = {k.lower(): v for k, v in json.load(f).items()}

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
    r = requests.post(GRAPHQL_URL, json={"query": exp_q}, headers=hdr)
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
    r = requests.post(GRAPHQL_URL,
                      json={"query": zone_q, "variables": {"expID": latest_exp}},
                      headers=hdr)
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
    print(f"Current raid: {raid_zone['name']} (ID={raid_zone['id']}) Current Dungeon Season: {dungeon_zone['name']} (ID={dungeon_zone['id']})")
    return raid_ids, dungeon_ids


def fetch_top_talents(token: str, encIDs: list[int], className: str, specName: str) -> str:
    """
    Fetches the top-100 character rankings JSON blob,
    parses it, aggregates talent picks, and returns
    a SimC override string of the most-popular points
    for each talentID.
    """
    query = """
    query TopBuild($encID: Int!, $class: String!, $spec: String!) {
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


    headers   = {"Authorization": f"Bearer {token}"}
    points_counter: dict[int, Counter[int]] = defaultdict(Counter)
    for encID in encIDs:
        variables = {"encID": encID, "class": className, "spec": specName}
        print(f"Requesting {variables}")
        resp = requests.post(GRAPHQL_URL, json={"query": query, "variables": variables}, headers=headers)
        resp.raise_for_status()
        for entry in resp.json()["data"]["worldData"]["encounter"]["characterRankings"]["rankings"]:
            for t in entry["talents"]:
                points_counter[t["talentID"]][t["points"]] += 1
    

    # 4) Pick the modal (most-common) points for each talentID
    most_popular = {
        tid: cnt.most_common(1)[0][0]
        for tid, cnt in points_counter.items()
    }

    # 5) Format as a comma-separated SimC override string
    #    e.g. "talent.96166=1,talent.96182=2,…"
    override = ",".join(f"talent.{tid}={pts}"
                        for tid, pts in sorted(most_popular.items()))

    return override

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
        for name in re.findall(r"buff\.([a-z0-9_]+)\.up", line, flags=re.IGNORECASE):
            deps.add(name.lower())
        # Grab all buff.foo_bar.remains> instances    
        for name in re.findall(r"buff\.([a-z0-9_]+)\.remains>", line, flags=re.IGNORECASE):
            deps.add(name.lower())    
    return deps


def extract_buff_ids_from_json(json_path: Path) -> dict[str, int]:
    """
    Read sim.players[0].buffs and buffs_constant to map buff name → spell ID.
    """
    data = json.loads(json_path.read_text())
    player = data["sim"]["players"][0]
    all_buffs = player.get("buffs", []) + player.get("buffs_constant", [])
    print(f"Found {len(all_buffs)} buffs in {json_path}")
    buff_map = {}
    for b in all_buffs:
        # each entry has "name" and numeric "id"
        buff_map[b["name"]] = b["id"]
    return buff_map

# ──────────────────────────────────────────────────────────
# Helpers: Running SimC with/without PI & Parsing DPS
# ──────────────────────────────────────────────────────────
def run_sim_in_memory(profile_text, enable_pi, num_targets=1):
    """
    Writes a temp file with (or without) PI override,
    runs simc, returns parsed DPS float.
    """
    sim_file = Path("_tmp.simc")
    json_file = Path("_tmp.json")
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
        f"--iterations={ITERATIONS}",
        f"--threads={THREADS}",
        "log_spell_id=1",
        "report_details=1",
        f"json2={json_file}",
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        # report the full stderr and a bit of stdout so we know what went wrong
        print(f"\n❌ SimC failed (exit {res.returncode}):\n")
        print(res.stderr)
        print("\n--- simc stdout tail ---")
        print("\n".join(res.stdout.splitlines()[-10:]))
        print("--- end stdout tail ---\n")
        raise RuntimeError(f"SimC exited {res.returncode}")
    
    m = re.search(
        r"(?:Damage per second:\s*|DPS=)\s*([\d,]+\.\d+)",
        res.stdout
    )
    if not m:
        # dump last 10 lines to help debug when parse fails
        print("\n--- simc stdout tail ---")
        print("\n".join(res.stdout.splitlines()[-10:]))
        print("--- end stdout tail ---\n")
        raise RuntimeError("Failed to parse DPS from simc output")
    # strip commas before float conversion
    dps_str = m.group(1).replace(",", "")

    data = json.loads(json_file.read_text())
    player = data["sim"]["players"][0]
    buffs_all = player.get("buffs", []) + player.get("buffs_constant", [])

    print(f"Found {len(buffs_all)} buffs in {json_file}")
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

# ──────────────────────────────────────────────────────────
# Main Pipeline
# ──────────────────────────────────────────────────────────
def main():
    # Env vars
    gh_token   = os.getenv("GITHUB_TOKEN")
    wcl_id     = os.getenv("WCL_CLIENT_ID")
    wcl_secret = os.getenv("WCL_CLIENT_SECRET")
    if not (wcl_id and wcl_secret):
        raise RuntimeError("Set WCL_CLIENT_ID & WCL_CLIENT_SECRET")
    print("fetching latest tier folder from GitHub...")
    # 1) Fetch tier profiles
    tier   = get_latest_tier_folder(gh_token)
    print(f"Latest tier folder: {tier}")
    print("fetching profiles...")
    profs  = fetch_profile_texts(tier)
    print(f"Found {len(profs)} profiles")

    # 2) WCL token & dynamic zone/boss
    print("fetching WCL token...")
    wcl_token = get_wcl_token(wcl_id, wcl_secret)
    print("fetching dynamic zone and boss...")
    raid_ids, dungeon_ids = fetch_current_tier_encounters(wcl_token)
    print(f"Raid IDs: {raid_ids}, Dungeon IDs: {dungeon_ids}")

    results = []
    # 3) For each profile: get top talents, inject, sim without/with PI
    for fname, text in profs.items():
        name_no_ext = fname[:-5]
        if name_no_ext.startswith(f"{tier}_"):
            slug = name_no_ext[len(tier)+1:]
        else:
            slug = name_no_ext
        slug_key = slug.lower()

        if slug_key not in PROFILE_MAP:
            print(f"⚠️  Skipping unknown slug {slug_key}")
            continue

        cfg = PROFILE_MAP[slug_key]
        class_name = cfg["classSlug"]
        spec_name  = cfg["specSlug"]
        spec_id = cfg["specId"]
        backup_spellids = cfg["backup_SpellId"]

        try:    
            raid_build = fetch_top_talents(wcl_token, raid_ids,    class_name, spec_name)
            dung_build = fetch_top_talents(wcl_token, dungeon_ids, class_name, spec_name)
        except RuntimeError as e:
            print(f"⚠️  Skipping {class_name} {spec_name}: {e}")
            continue
        # inject talents override at top of profile
        prof_raid = (
            f"# {class_name}/{spec_name} raid build\n"
            + re.sub(r"^(player=.*)$", rf"\1,talents={raid_build}", text, flags=re.M)
        )
        prof_dung = (
            f"# {class_name}/{spec_name} dungeon build\n"
            + re.sub(r"^(player=.*)$", rf"\1,talents={dung_build}", text, flags=re.M)
        )
        for nt in TARGET_COUNTS:
            # use raid profile for single target, dungeon profile otherwise
            prof = prof_raid if nt == 1 else prof_dung
            try:
                d0, buffs = run_sim_in_memory(prof, enable_pi=False, num_targets=nt)
                d1, buffs = run_sim_in_memory(prof, enable_pi=True, num_targets=nt)
            except RuntimeError as e:
                print(f"⚠️  Skipping {class_name} {spec_name}: {e}")
                continue
            delta = d1 - d0
            pct   = (delta / d0) * 100
            # Extract which buffs guard PI in this profile
            dependencies = extract_external_buffs(text)
            # Look up their IDs in the "with PI" run
            print(f"PI dependencies: {dependencies}")
            dep_ids = {}
            for buff in dependencies:
                sid = buffs.get(buff)
                if sid is None:
                    print(f"⚠️ Could not resolve buff '{buff}'")
                dep_ids[buff] = sid
            if dep_ids == {}:
                print(f"⚠️ No dependencies found falling back to backup spellids")
                for buff_id in backup_spellids:
                    print(f"Backup spellid: {buff_id}")
                    dep_ids[buff_id] = buff_id    

            results.append({
                "spec":          spec_name,
                "class":         class_name,
                "specId":        spec_id,
                "targets":       nt,
                "dps_no_pi":     round(d0,2),
                "dps_with_pi":   round(d1,2),
                "dps_delta":     round(delta,2),
                "dps_pct_gain":  round(pct,2),
                "pi_dep_spell_ids": dep_ids,
            })
            print(f"→ {spec_name} [{nt} targets]: Δ={delta:.2f} ({pct:.2f}%)")

    # 4) Save to JSON
    OUT_JSON.parent.mkdir(exist_ok=True)
    OUT_JSON.write_text(json.dumps(results, indent=2))
    print(f"✅ Saved PI values to {OUT_JSON}")

if __name__ == "__main__":
    main()
