"""Deploy this repository to a Hugging Face Space (Docker SDK) so the whole app has a public URL.

The Dockerfile already builds the frontend, seeds the demo data and serves everything on port 7860, which is the port
Hugging Face Spaces expects. This script exports the last *committed* state of the repo, adds the Space front matter
to the README (the GitHub README is left unchanged) and uploads it.

    $env:HF_TOKEN = "hf_..."          # a token with Write access (huggingface.co/settings/tokens)
    python scripts/deploy_hf_space.py --space aicte-verisense

Options: --private (visible only to you), --dry-run (build the export and stop before any upload).
Needs: git, tar, and `pip install huggingface_hub`.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FRONT_MATTER = """---
title: AICTE VeriSense
colorFrom: blue
colorTo: yellow
sdk: docker
app_port: 7860
license: mit
short_description: Evidence-on-the-page validation of AICTE approval applications (SIH 2026, PS 26261)
---

"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--space", default="aicte-verisense", help="Space name (default: aicte-verisense)")
    ap.add_argument("--private", action="store_true", help="create the Space as private")
    ap.add_argument("--dry-run", action="store_true", help="export and check the files, but upload nothing")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    work = Path(tempfile.mkdtemp(prefix="verisense-space-"))
    try:
        tar = work / "src.tar"
        subprocess.run(["git", "-C", str(root), "archive", "--format=tar", "-o", str(tar), "HEAD"], check=True)
        out = work / "space"
        out.mkdir()
        subprocess.run(["tar", "-xf", str(tar), "-C", str(out)], check=True)

        readme = out / "README.md"
        readme.write_text(FRONT_MATTER + readme.read_text(encoding="utf-8"), encoding="utf-8")
        for needed in ("Dockerfile", "backend/serve.py", "frontend/package.json", "samples/scenarios.json"):
            if not (out / needed).exists():
                print(f"Missing from the export: {needed}. Commit your changes first.", file=sys.stderr)
                return 1
        files = [p for p in out.rglob("*") if p.is_file()]
        size_mb = sum(p.stat().st_size for p in files) / 1048576
        print(f"Export ready: {len(files)} files, {size_mb:.1f} MB")
        if args.dry_run:
            print("Dry run: nothing uploaded.")
            return 0

        token = os.environ.get("HF_TOKEN")
        if not token:
            print("Set HF_TOKEN to a Hugging Face token with Write access first.", file=sys.stderr)
            return 1
        from huggingface_hub import HfApi

        api = HfApi(token=token)
        user = api.whoami()["name"]
        repo_id = f"{user}/{args.space}"
        api.create_repo(repo_id, repo_type="space", space_sdk="docker", private=args.private, exist_ok=True)
        api.upload_folder(folder_path=str(out), repo_id=repo_id, repo_type="space", commit_message="Deploy AICTE VeriSense")
        print(f"\nSpace page : https://huggingface.co/spaces/{repo_id}")
        print(f"Live site  : https://{user.lower()}-{args.space}.hf.space  (ready after the first build, a few minutes)")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
