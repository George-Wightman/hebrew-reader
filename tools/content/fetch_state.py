"""Fetch George's synced progress.json and decode it to a state_keys.json OUTSIDE this repo.

    python fetch_state.py <out-dir>        # e.g. the session scratchpad

Handles both envelopes (plain, and gzip since 2026-09-07) and the Contents API's 1MB
cliff (refetches by sha from git/blobs). The token is read from its file and never
printed. The repo is public: this refuses to write anywhere inside it.
"""
import base64, gzip, json, os, sys, urllib.request

TOKEN_PATH = os.path.expanduser(
    r"~\.claude\projects\C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning"
    r"\secrets\hebrew-reader-sync-token.txt")
API = "https://api.github.com/repos/George-Wightman/hebrew-reader-sync"
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token,
                                               "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out_dir = os.path.abspath(sys.argv[1])
    if out_dir == REPO or out_dir.startswith(REPO + os.sep):
        sys.exit("refusing to write his synced data inside the repo (it is public)")
    token = open(TOKEN_PATH, encoding="utf-8").read().strip()
    raw = get(API + "/contents/progress.json", token)
    if not raw.get("content"):                      # over 1MB: the Contents API inlines nothing
        raw = get(API + "/git/blobs/" + raw["sha"], token)
    outer = json.loads(base64.b64decode("".join(raw["content"].split())).decode("utf-8"))
    if outer.get("enc") == "gzip":
        blob = json.loads(gzip.decompress(base64.b64decode("".join(outer["body"].split()))).decode("utf-8"))
    else:
        blob = outer
    keys = blob.get("keys")
    assert isinstance(keys, dict) and keys, "decoded to no keys — envelope changed; do not treat as empty"
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "state_keys.json")
    json.dump(keys, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    print("synced", blob.get("updated"), "-", len(keys), "keys ->", path)


if __name__ == "__main__":
    main()
