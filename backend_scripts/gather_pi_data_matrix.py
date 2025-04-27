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
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Current raid: {raid_zone['name']} (ID={raid_zone['id']}) Current Dungeon Season: {dungeon_zone['name']} (ID={dungeon_zone['id']})")
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
    # 4) Collect each full-build from every ranking entry

    all_builds: list[tuple[tuple[tuple[int,int],...], int]] = []
    for encID in encIDs:
        variables = {"encID": encID, "class": className, "spec": specName}
        resp = requests.post(GRAPHQL_URL, json={"query": query, "variables": variables}, headers=headers)
        resp.raise_for_status()
        for entry in resp.json()["data"]["worldData"]["encounter"]["characterRankings"]["rankings"]:
            # build = sorted list of (talentID, points)
            talents = tuple(sorted((t["talentID"], t["points"]) for t in entry["talents"]))
            total_pts = sum(p for _, p in talents)
            all_builds.append((talents, total_pts))

    if not all_builds:
        raise RuntimeError("No builds returned from WCL")

    # 5) Determine the cap (max points)
    max_points = max(total for _, total in all_builds)

    # 6) Keep only builds that spent all points
    valid_builds = [talents for talents, total in all_builds if total == max_points]
    if not valid_builds:
        raise RuntimeError(f"No builds found spending all {max_points} points")

    # 7) Find the single most-popular full build
    build_counter = Counter(valid_builds)
    popular_build, count = build_counter.most_common(1)[0]
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Found {len(build_counter)} unique builds, most popular: {count}")

    return popular_build



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

def merge_results():
    # find all sim JSON outputs
    sim_paths = glob.glob(str(FINAL_SIM_PATH / "**" / "*.json"), recursive=True)

    # organize by (class, spec, targets)
    runs: dict[tuple[str,str,int], dict[bool, Path]] = {}
    for p in map(Path, sim_paths):
        # p = data/sims/final_sims/<Class>_<Spec>/<targets>_<pi>.json
        folder, fname = p.parent.name, p.name
        cls, spec, nt_str, pi_str = p.stem.split("_")
        if pi_str.lower() in ("true","false"):
            pi_flag = pi_str.lower() == "true"
        else:
            pi_flag = bool(int(pi_str))  
        key = (cls, spec, nt_str)
        runs.setdefault(key, {})[ pi_flag ] = p
    results = []
    # reload PROFILE_MAP so we can look up backups
    with open(CONFIG_PATH) as f:
        profile_map = {k.lower(): v for k,v in json.load(f).items()}

    by_class_spec = {
    (v["classSlug"], v["specSlug"]): v
    for v in PROFILE_MAP.values()
    }

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
        prof_file = PROFILE_PATH / f"{cls}_{spec}_{nt}_{1}.simc"
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
        raid_build = fetch_top_talents(wcl_token, raid_ids, cls, spec)
        dung_build = fetch_top_talents(wcl_token, dungeon_ids, cls, spec)
        rcls, rspec, rhero = split_tree_overrides(raid_build)
        dcls, dspec, dhero = split_tree_overrides(dung_build)
        prof_raid = inject_overrides(text, rcls, rspec, rhero)
        prof_dung = inject_overrides(text, dcls, dspec, dhero)

        for nt in TARGET_COUNTS:
            prof = prof_raid if nt==1 else prof_dung
            for pi_flag in (False, True):
                fname = f"{cls}_{spec}_{nt}_{int(pi_flag)}.simc"
                simf = PROFILE_PATH / fname
                simf.write_text(prof)
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
    override = ""
    if args.pi:
        override += "\n# Power Infusion\nexternal_buffs.pool=power_infusion:120:1\n"
    for i in range(1, args.targets+1):
        override += f"enemy=TrainingDummy{i}\n"

    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Running sim with args {args}")
    content = Path(args.sim_file).read_text()
    print(f"[{datetime.datetime.now(datetime.timezone.utc).isoformat()}] Running sim for file {content}")
    Path(args.sim_file).write_text(content + override)

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
