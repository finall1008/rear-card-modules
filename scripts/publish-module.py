#!/usr/bin/env python3
"""Update an existing shop entry from the ZIP uploaded by a module release job."""
import argparse
import base64
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen
from zipfile import ZipFile

STORE = "finall1008/rear-card-modules"
API = f"https://api.github.com/repos/{STORE}/contents/modules.json"
FIELDS = ("name", "version", "versionCode", "apiVersion", "description", "author", "capabilities")


def update_entry(catalog, module, repository, tag, filename):
    if tag != "v" + module["version"]:
        raise ValueError("Release tag must match the ZIP module version")
    entry = next(m for m in catalog["modules"] if m["id"] == module["id"])
    repo_url = f"https://github.com/{repository}"
    if entry["repository"] != repo_url:
        raise ValueError("Module repository does not match its shop entry")
    if module["versionCode"] < entry["versionCode"]:
        return False
    if module["versionCode"] == entry["versionCode"] and module["version"] != entry["version"]:
        raise ValueError("A different module version must increase versionCode")
    published = {key: module[key] for key in FIELDS}
    published.update(
        releaseUrl=f"{repo_url}/releases/tag/{quote(tag, safe='')}",
        downloadUrl=f"{repo_url}/releases/download/{quote(tag, safe='')}/{quote(filename, safe='')}",
    )
    if all(entry.get(key) == value for key, value in published.items()):
        return False
    entry.update(published)
    return True


def request_json(method, url, token, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "rear-card-module-release",
    })
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def publish(archive, repository, tag, token):
    with ZipFile(archive) as package:
        module = json.loads(package.read("module.json"))
    # Contents API SHA prevents overwriting the other module's concurrent release.
    for attempt in range(3):
        current = request_json("GET", API + "?ref=main", token)
        catalog = json.loads(base64.b64decode(current["content"]))
        if not update_entry(catalog, module, repository, tag, Path(archive).name):
            print(f"Shop already has this release or a newer version: {module['id']}")
            return
        content = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
        payload = {
            "message": f"chore: update {module['id']} to {module['version']}",
            "content": base64.b64encode(content.encode()).decode(),
            "sha": current["sha"],
            "branch": "main",
        }
        try:
            result = request_json("PUT", API, token, payload)
        except HTTPError as error:
            if error.code == 409 and attempt < 2:
                continue
            raise
        print(f"Shop updated: {result['commit']['html_url']}")
        return


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--tag", required=True)
    args = parser.parse_args()
    token = os.environ.get("MODULE_STORE_TOKEN")
    if not token:
        parser.error("Set the MODULE_STORE_TOKEN Actions secret (shop repository Contents: read/write)")
    publish(args.archive, args.repository, args.tag, token)
