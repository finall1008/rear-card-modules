import base64
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location("publisher", Path(__file__).with_name("publish-module.py"))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)
REPO = "finall1008/xiaomi-backscreen-ai-token"


class PublishModuleTest(unittest.TestCase):
    def setUp(self):
        self.catalog = json.loads(Path(__file__).parents[1].joinpath("modules.json").read_text())
        self.original = copy.deepcopy(self.catalog)
        self.module = {k: self.catalog["modules"][0][k] for k in publisher.FIELDS}
        self.module["id"] = self.catalog["modules"][0]["id"]
        self.module["versionCode"] += 1
        self.module["version"] = "0.2.4"
        self.tag = "v0.2.4"
        self.filename = "ai-usage-0.2.4.zip"

    def update(self, repository=REPO, tag=None):
        return publisher.update_entry(self.catalog, self.module, repository, tag or self.tag, self.filename)

    def test_update_preserves_other_module_and_shop_fields(self):
        self.assertTrue(self.update())
        changed = self.catalog["modules"][0]
        self.assertEqual(changed["version"], "0.2.4")
        self.assertEqual(changed["downloadUrl"], f"https://github.com/{REPO}/releases/download/{self.tag}/{self.filename}")
        for key in ("tags", "previews"):
            self.assertEqual(changed[key], self.original["modules"][0][key])
        self.assertEqual(self.catalog["modules"][1:], self.original["modules"][1:])

    def test_repeat_and_older_release_do_not_commit(self):
        self.update()
        self.assertFalse(self.update())
        self.module["versionCode"] -= 1
        self.assertFalse(self.update())

    def test_wrong_tag_or_repository_is_rejected(self):
        with self.assertRaises(ValueError):
            self.update(tag="v0.2.3")
        with self.assertRaises(ValueError):
            self.update(repository="finall1008/xiaomi-backscreen-maimai-profile")

    def test_version_change_requires_higher_version_code(self):
        self.module["versionCode"] = self.original["modules"][0]["versionCode"]
        with self.assertRaises(ValueError):
            self.update()

    def test_concurrent_release_refetches_and_preserves_other_update(self):
        newer = copy.deepcopy(self.original)
        newer["modules"][1]["versionCode"] += 1
        newer["modules"][1]["version"] = "1.0.5"

        def response(catalog, sha):
            return {"sha": sha, "content": base64.b64encode(json.dumps(catalog).encode()).decode()}

        calls = [response(self.original, "before"), HTTPError(publisher.API, 409, "Conflict", {}, None),
                 response(newer, "after"), {"commit": {"html_url": "https://github.com/example/commit/test"}}]
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / self.filename
            with ZipFile(archive, "w") as package:
                package.writestr("module.json", json.dumps(self.module))
            with patch.object(publisher, "request_json", side_effect=calls) as request:
                publisher.publish(archive, REPO, self.tag, "test-token")
        payload = request.call_args_list[-1].args[3]
        published = json.loads(base64.b64decode(payload["content"]))
        self.assertEqual(payload["sha"], "after")
        self.assertEqual(published["modules"][1], newer["modules"][1])
        self.assertEqual(published["modules"][0]["version"], "0.2.4")


if __name__ == "__main__":
    unittest.main()
