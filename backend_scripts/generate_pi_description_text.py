import requests
import os
import re
import json
from openai import OpenAI
import string

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

def fetch_pi_config():
    with open("backend_scripts/piConfig.json") as f:
        profile_map = {k.lower(): v for k,v in json.load(f).items()}
    class_and_specs = set()
    for spec in profile_map.values():
        print(spec)
        print(spec["classSlug"]+"_"+spec["specSlug"])    
        class_and_specs.add(spec["classSlug"].upper()+"_"+spec["specSlug"].upper())
    return class_and_specs
def extract_class_spec(lines):
    """
    Find the class variable (e.g. 'paladin') and spec (e.g. 'protection') from the profile.
    """
    class_var = None
    spec_val  = None

    # class line: paladin="TWW2_Paladin_Protection..." 
    for line in lines:
        m = re.match(r'^([a-z_]+)=["\']', line)
        if m:
            class_var = m.group(1).upper()
            break

    # spec line: spec=protection 
    for line in lines:
        if line.strip().startswith("spec="):
            spec_val = line.split("=", 1)[1].strip()
            break

    if class_var and spec_val:
        return f"{class_var}_{spec_val.upper()}"
    return None

def get_openai_client(api_key):   
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    return client

def llm_describe(client, line, player_class, player_spec, model: str = "deepseek/deepseek-r1:free"):
    """
    Fallback: send the raw APL line to OpenAI and ask for a human-readable rewrite.
    """
    prompt = (

        """
        You are an expert at translating SimulationCraft APL (action priority list) logic into concise, human-readable HTML descriptions.  Your user is a Priest whose sole concern is when to cast Power Infusion on a {{player_spec}} {{player_class}}.  Follow these rules:

        1.  Fetch and reference only the most authoritative online guides for the {player_spec} {player_class} to determine which conditions matter for Power Infusion.  
        2.  Parse the given APL line using only it's content when deciding the conditions, treating `&` as logical AND and `|` as logical OR.
        3.  Discard any checks irrelevant to a Priest providing Power Infusion (e.g. damage rotations, defensive cooldowns).
        4.  Output only an HTML snippet that fits this strict format: 
            - Start with a paragraph (<p>) like: "Use <strong>Power Infusion</strong> on the {player_spec} {player_class} when:"
            - Follow with a bullet list (<ul>) where each relevant condition is a <li>, written in a complete, natural sentence.
            - Each <li> must be clear, concise, and use <strong>HTML bold tags</strong> (<strong>) to highlight important cooldown names or abilities.  
        5.  Keep styling minimal and professional. Avoid adding inline styles or unnecessary formatting.
        6.  Never use asterisks, square brackets, or markdown syntax. Your entire response must be pure HTML.

        Here is the APL line to convert: {apl_line}

        """
    )
    resp = client.chat.completions.create(
        extra_headers={},
        extra_body={},
        model=model,
        messages=[
            {
            "role": "user",
            "content": prompt.format(
                player_spec=player_spec,
                player_class=player_class,
                apl_line=line,
            )
            }
        ]
    )
    raw = resp.choices[0].message.content.strip()
    print(f"fetched description for{player_class} {player_spec}: {line}")
    print(resp)
    cleaned = re.sub(r"[\*\[\]]+", "", raw)
    return cleaned

def main():
    gh_token = os.getenv("GITHUB_TOKEN")
    tier     = get_latest_tier_folder(gh_token)
    profs    = fetch_profile_texts(tier)
    pi_config = fetch_pi_config()
    print(pi_config)
    explanations = {}
    print(f"Found {len(profs)} profiles in {tier}")
    client = get_openai_client(os.getenv("OPENROUTER_API_KEY"))
    for filename, text in profs.items():
        lines = text.splitlines()  # split into lines 
        key   = extract_class_spec(lines)
        print("Key: ", key)
        if not key or key in explanations or not key in pi_config:
            continue

        # find Power Infusion invocation and its preceding comments
        for idx, line in enumerate(lines):
            if "invoke_external_buff,name=power_infusion" in line:
                class_var =  string.capwords(key.split("_")[0].lower())
                spec_var  =  string.capwords(key.split("_")[1].lower())
                description = llm_describe(client, line, class_var, spec_var)
                explanations[key] = description  
                break

    # write to data/piExplanations.json
    os.makedirs("data", exist_ok=True)  # create dirs safely 
    with open("data/piExplanations.json", "w", encoding="utf-8") as f:
        json.dump(explanations, f, indent=2, ensure_ascii=False)  # human-readable JSON 

    print(f"Saved {len(explanations)} explanations to data/piExplanations.json")

if __name__ == "__main__":
    main()
