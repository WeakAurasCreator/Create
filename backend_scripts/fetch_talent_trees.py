import os
import json
import glob
import requests

# Constants
REGION         = "eu"
NAMESPACE      = "static-eu"
INDEX_ENDPOINT = f"https://{REGION}.api.blizzard.com/data/wow/talent-tree/index?namespace={NAMESPACE}"
TOKEN_URL      = "https://oauth.battle.net/token"


def get_oauth_token(client_id: str, client_secret: str) -> str:
    """
    Perform client_credentials OAuth2 flow to get a Bearer token.
    """
    resp = requests.post(
        TOKEN_URL,
        auth=(client_id, client_secret),
        data={"grant_type": "client_credentials"},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_json(url: str, token: str) -> dict:
    """
    GET a URL with Bearer auth, return parsed JSON.
    """
    resp = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    resp.raise_for_status()
    return resp.json()


def slugify(name: str) -> str:
    # simple: lowercase and replace spaces with underscores
    return name.strip().lower().replace(" ", "_")


def save(data: dict, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def build_talent_meta(class_tree: dict, spec_tree: dict) -> dict:
    """
    Merge class_tree['talent_nodes'] + spec_tree['class_talent_nodes']
    into a mapping talent_id → { row, max_rank, prereqs: [...], choice_group: [...] }.
    """
    nodes = class_tree.get('talent_nodes', []) + spec_tree.get('class_talent_nodes', [])
    # Map node.id → node data
    by_node = {n['id']: n for n in nodes}
    # Build reverse prereqs from 'unlocks'
    prereq_map: dict[int, list[int]] = {}
    for n in nodes:
        for unlocked in n.get('unlocks', []):
            prereq_map.setdefault(unlocked, []).append(n['id'])
    # Group CHOICE nodes by display_row
    choice_groups: dict[int, list[int]] = {}
    for n in nodes:
        if n['node_type']['type'] == 'CHOICE':
            row = n['display_row']
            choice_groups.setdefault(row, []).append(n['id'])
    # Build metadata
    meta: dict[int, dict] = {}
    for n in nodes:
        node_prereqs = prereq_map.get(n['id'], [])
        group = choice_groups.get(n['display_row'], [])
        ranks = n.get('ranks', [])
        max_rank = len(ranks)
        for r in ranks:
            # some spec choice nodes have no tooltip (ranks without talent info)
            if 'tooltip' not in r or 'talent' not in r['tooltip']:
                continue
            tid = r['tooltip']['talent']['id']
            meta[tid] = {
                'row': n['display_row'],
                'max_rank': max_rank,
                'prereqs': node_prereqs,
                'choice_group': group,
            }
    return meta


def main():
    client_id     = os.environ['CLIENT_ID']
    client_secret = os.environ['CLIENT_SECRET']
    token = get_oauth_token(client_id, client_secret)
    print("Token fetched.")

    # 1. Fetch the master index
    index = fetch_json(INDEX_ENDPOINT, token)
    print("Index fetched.")

    # 2. Spec talent trees
    for item in index.get("spec_talent_trees", []):
        url  = item["key"]["href"]
        spec_data = fetch_json(url, token)

        spec_id = spec_data['playable_specialization']['id']
        spec_slug = slugify(item['name']['en_US'])
        spec_path = f"data/talents/spec/{spec_id}.json"
        print(f"→ Saving SPEC tree: {spec_path}")
        save(spec_data, spec_path)

    # 3. Class talent trees
    for item in index.get("class_talent_trees", []):
        url  = item["key"]["href"]
        class_data = fetch_json(url, token)

        tree_id = class_data['id']
        class_slug = slugify(item['name']['en_US'])
        class_path = f"data/talents/class/{tree_id}.json"
        print(f"→ Saving CLASS tree: {class_path}")
        save(class_data, class_path)

    print("All raw talent-trees fetched and saved.")

if __name__ == "__main__":
    main()
