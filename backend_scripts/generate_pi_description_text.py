import requests
import os
import re
import json

GITHUB_API = "https://api.github.com/repos/simulationcraft/simc/contents/profiles"
RAW_BASE   = "https://raw.githubusercontent.com/simulationcraft/simc/master/profiles"

def get_latest_tier_folder(token=None):
    headers = {"Authorization": f"token {token}"} if token else {}
    resp = requests.get(GITHUB_API, headers=headers)
    resp.raise_for_status()
    tiers = [e["name"] for e in resp.json()
             if e["type"] == "dir"
             and not e["name"].lower().startswith("pre")
             and e["name"] not in ("generators", "tests")]
    return sorted(tiers)[-1]

def fetch_profile_texts(tier_folder):
    resp = requests.get(f"{GITHUB_API}/{tier_folder}")
    resp.raise_for_status()
    profiles = {}
    for e in resp.json():
        name = e["name"]
        if name.endswith(".simc"):
            raw_url = f"{RAW_BASE}/{tier_folder}/{name}"
            profiles[name] = requests.get(raw_url).text
    return profiles

def extract_class_spec(lines):
    """
    Find the class variable (e.g. 'paladin') and spec (e.g. 'protection') from the profile.
    """
    class_var = None
    spec_val  = None

    # class line: paladin="TWW2_Paladin_Protection..." :contentReference[oaicite:5]{index=5}
    for line in lines:
        m = re.match(r'^([a-z_]+)=["\']', line)
        if m:
            class_var = m.group(1).upper()
            break

    # spec line: spec=protection :contentReference[oaicite:6]{index=6}
    for line in lines:
        if line.strip().startswith("spec="):
            spec_val = line.split("=", 1)[1].strip()
            break

    if class_var and spec_val:
        return f"{class_var}_{spec_val.upper()}"
    return None

def main():
    gh_token = os.getenv("GITHUB_TOKEN")
    tier     = get_latest_tier_folder(gh_token)
    profs    = fetch_profile_texts(tier)

    explanations = {}
    for filename, text in profs.items():
        lines = text.splitlines()  # split into lines :contentReference[oaicite:7]{index=7}
        key   = extract_class_spec(lines)
        if not key or key in explanations:
            continue

        # find Power Infusion invocation and its preceding comments
        for idx, line in enumerate(lines):
            if "invoke_external_buff,name=power_infusion" in line:
                comments = []
                j = idx - 1
                while j >= 0 and lines[j].strip().startswith("#"):
                    # strip whitespace, remove leading '#' then strip again :contentReference[oaicite:8]{index=8}
                    comment = lines[j].strip().lstrip("#").strip()
                    comments.insert(0, comment)
                    j -= 1
                explanations[key] = " ".join(comments)
                break

    # write to data/piExplanations.json
    os.makedirs("data", exist_ok=True)  # create dirs safely :contentReference[oaicite:9]{index=9}
    with open("data/piExplanations.json", "w", encoding="utf-8") as f:
        json.dump(explanations, f, indent=2, ensure_ascii=False)  # human-readable JSON :contentReference[oaicite:10]{index=10}

    print(f"Saved {len(explanations)} explanations to data/piExplanations.json")

if __name__ == "__main__":
    main()
