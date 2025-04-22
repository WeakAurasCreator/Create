#!/usr/bin/env python3
import os
import re
import json
import shutil
import requests
import subprocess
from pathlib import Path

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

def fetch_current_tier_zone_and_boss(wcl_token: str) -> tuple[int,int]:
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

    # 3) Filter for *actual* Mythic raid zones (ID 16) and skip any “Complete Raids…” ones
    raid_zones = [
      z for z in all_zones
      if any(d["id"] == 5 for d in z["difficulties"])
         and "complete raids" not in z["name"].lower()
    ]
    if not raid_zones:
        raise RuntimeError(f"No valid raid zones found in expansion {latest_exp}")

    zone = raid_zones[0]
    boss = zone["encounters"][0]
    print(f"Current raid: {zone['name']} (ID={zone['id']}), "
          f"first boss: {boss['name']} (ID={boss['id']})")
    return zone["id"], boss["id"]

import json
import requests

def fetch_top_talents(token: str, boss_id: int, className: str, specName: str):
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
            partition: 1
          )
        }
      }
    }
    """

    variables = {"encID": boss_id, "class": className, "spec": specName}
    headers   = {"Authorization": f"Bearer {token}"}
    print(f"Requesting {variables}")
    resp = requests.post(GRAPHQL_URL,
                         json={"query": query, "variables": variables},
                         headers=headers)
    resp.raise_for_status()
    print(resp.json())
    # 1) JSON blob returned as a string
    data = resp.json()["data"]["worldData"]["encounter"]["characterRankings"]

    # 2) Extract the rankings list
    rankings = data.get("rankings", [])
    if not rankings:
        raise RuntimeError(f"No ranking rows for {variables}. Response is: {resp.json()}")

    # 3) Tally up points for each talentID across the top‑100
    from collections import defaultdict, Counter
    points_counter: dict[int, Counter[int]] = defaultdict(Counter)
    for entry in rankings:
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



# ──────────────────────────────────────────────────────────
# Helpers: Running SimC with/without PI & Parsing DPS
# ──────────────────────────────────────────────────────────
def run_sim_in_memory(profile_text, enable_pi):
    """
    Writes a temp file with (or without) PI override,
    runs simc, returns parsed DPS float.
    """
    tmp = Path("_tmp.simc")
    pi_flag = 1 if enable_pi else 0
    override = (
        "\n# Power Infusion override\n"
        f"external_buffs.pool=power_infusion:120:{pi_flag}\n"
    )
    tmp.write_text(profile_text + override)
    cmd = [
        SIMC_CMD, str(tmp),
        f"--iterations={ITERATIONS}",
        f"--threads={THREADS}"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    print(res)    
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
    return float(dps_str)

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
    zone_id, boss_id = fetch_current_tier_zone_and_boss(wcl_token)
    print(f"Zone ID: {zone_id}, Boss ID: {boss_id}")

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

        try:    
            build = fetch_top_talents(wcl_token, boss_id, class_name, spec_name)
        except RuntimeError as e:
            print(f"⚠️  Skipping {class_name} {spec_name}: {e}")
            continue
        # inject talents override at top of profile
        header = f"# Generated for {class_name} {spec_name}, talents={build}\n"
        prof   = header + re.sub(
            r"^(player=.*)$", rf"\1,talents={build}", text, flags=re.MULTILINE
        )

        # run sims
        d0 = run_sim_in_memory(prof, enable_pi=False)
        d1 = run_sim_in_memory(prof, enable_pi=True)
        delta = d1 - d0
        pct   = (delta / d0) * 100

        results.append({
            "spec":          spec_name,
            "build":         build,
            "dps_no_pi":     round(d0,2),
            "dps_with_pi":   round(d1,2),
            "dps_delta":     round(delta,2),
            "dps_pct_gain":  round(pct,2),
        })
        print(f"→ {spec_name}: Δ={delta:.2f} ({pct:.2f}%)")

    # 4) Save to JSON
    OUT_JSON.parent.mkdir(exist_ok=True)
    OUT_JSON.write_text(json.dumps(results, indent=2))
    print(f"✅ Saved PI values to {OUT_JSON}")

if __name__ == "__main__":
    main()
