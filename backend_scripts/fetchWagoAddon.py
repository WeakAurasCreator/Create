import base64
import requests
import os
import json
from Crypto.Cipher import AES
import zipfile
import re
import io
from collections import defaultdict
# ─── CONFIG ────────────────────────────────────────────────────────────────────
FILE_NAME     = os.getenv("FILE_NAME")      
PARENT_KEY    = os.getenv("PARENT_KEY")     
OUTPUT_DIR  = "assets/json"
raw_key = os.getenv("WAGO_ADDONS_DECRYPT_KEY")
raw_iv  = os.getenv("WAGO_ADDONS_DECRYPT_IV")

KEY = raw_key.encode("utf-8")
IV  = raw_iv.encode("utf-8")
# ────────────────────────────────────────────────────────────────────────────────

addon_id = os.getenv("ADDON_ID")

def decrypt_wago(encoded):
    unpad = lambda s: s[:-ord(s[len(s) - 1:])]
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    decoded = base64.b64decode(encoded)
    unencrypted = cipher.decrypt(decoded)
    return unpad(unencrypted)

def fetch_wago_addon(addon_id):
    url = f"https://addons.wago.io/api/client/addons/{addon_id}"
    headers = {
        "X-Wago-Iteration": "1"
    }
    print(f"Fetching addon from {url}")
    print(headers)
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return decrypt_wago(response.json()["blob"])
    else:
        raise Exception(f"Failed to fetch addon: {response.status_code}")
    
def parse_lsm_registers(lua_text: str):
    """
    Returns a dict mapping TYPE -> [ { name: LABEL, value: PATH }, … ]
    Handles VALUE as either "..." or [[...]].
    """
    regex = re.compile(
        r'''LSM:Register\s*\(\s*
            "(?P<type>[^"]+)"\s*,\s*           # TYPE
            "(?P<label>[^"]+)"\s*,\s*          # LABEL
            (?:
               "(?P<val1>[^"]+)"               # value in double-quotes
             |
               \[\[ (?P<val2>.*?) \]\]         # or value in [[...]]
            )
        ''',
        re.IGNORECASE | re.VERBOSE | re.DOTALL
    )

    groups = defaultdict(list)
    for m in regex.finditer(lua_text):
        t     = m.group("type")
        label = m.group("label")
        val   = m.group("val1") if m.group("val1") is not None else m.group("val2")
        groups[t].append({"name": label, "value": val})
    return groups
def main():
    # 1) pull down & decrypt the addon JSON
    addon_bytes = fetch_wago_addon(addon_id)
    addon_json  = json.loads(addon_bytes.decode("utf-8"))
    dl_link     = addon_json["metadata"]["recent_releases"]["retail"]["download_link"]

    # 2) fetch the ZIP into memory
    zresp   = requests.get(dl_link);  zresp.raise_for_status()
    zip_mem = io.BytesIO(zresp.content)
    with zipfile.ZipFile(zip_mem) as z:
        try:
            lua_bytes = z.read(FILE_NAME)
        except KeyError:
            raise FileNotFoundError(f"{FILE_NAME} not found in the ZIP")
    lua_text = lua_bytes.decode("utf-8")

    # 3) parse out every LSM:Register
    all_groups = parse_lsm_registers(lua_text)
    print(f"Found entries for types: {list(all_groups)}")

    # 4) ensure output dir exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 5) for each media type, update its JSON
    for media_type, entries in all_groups.items():
        out_path = os.path.join(OUTPUT_DIR, f"{media_type}.json")

        # load or initialize
        if os.path.exists(out_path):
            with open(out_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {
                "default": {"values": []},
                PARENT_KEY: {"values": []}
            }

        # overwrite
        data.setdefault(PARENT_KEY, {})["values"] = entries

        # write back
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        print(f" → Wrote {len(entries)} entries to {out_path}")

if __name__ == "__main__":
    main()
