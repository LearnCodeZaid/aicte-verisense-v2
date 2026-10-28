# Hosted demo

## Quickest public link: Hugging Face Space

The Dockerfile serves the whole app (frontend, API and the preprocessed demo data) on port 7860, the port Hugging Face
Spaces uses, and runs as user 1000. Create a free account, make a token with **Write** access
(huggingface.co/settings/tokens), then from the repository root:

```bash
export HF_TOKEN=hf_...            # PowerShell: $env:HF_TOKEN = "hf_..."
pip install huggingface_hub
python scripts/deploy_hf_space.py --space aicte-verisense
```

The script uploads the last committed state, adds the Space front matter to the README (the GitHub README is unchanged),
and prints the live URL. The first build takes a few minutes. Use `--private` to keep the Space visible only to you, or
`--dry-run` to check the export without uploading. Free Spaces have no persistent disk, so uploads and edits reset when
the Space restarts; the seeded demo data is always restored.

## Other hosts

The frontend can run on ChatGPT Sites. Live OCR, uploads, findings, rules and
decisions run on the Python backend on a separate Docker-capable host.

`render.yaml` selects Render's free service and the `wip/verisense-v2` branch.
The Docker build includes the frontend, Python dependencies, synthetic documents,
and a preprocessed demo database. First startup copies that snapshot to `/data`.
This avoids running the entire OCR seed during a cold web startup.

Render's free service uses ephemeral storage: uploaded documents and demo edits
are lost when the service restarts or redeploys. Its instance can sleep when idle;
the first subsequent request can take longer. Do not use it for real applications.
The free plan's 512 MB memory must be verified against OCR upload workloads; the
container has one application worker to limit concurrency. Free hosting is a demo
configuration, not a promise of production capacity or durability.

OCR defaults to one intra/inter-op thread per ONNX session and serialises shared
model inference. OpenCV also uses one thread in the container. This avoids sizing
thread pools from the host CPU count rather than the instance's actual quota.
OCR models are released before forensic/QR analysis to avoid overlapping their
memory peaks. Larger hosts can opt into model caching with `VERISENSE_OCR_CACHE=1`.
Text detection uses a maximum 960-pixel side, with recognition on crops from the
original image. The detector's library default instead preserves large inputs
and can exceed the free instance's memory budget on a scanned page.

To preserve changes on another host, attach persistent storage at `/data`. The
entrypoint preserves an existing database and uploads and keeps its JWT signing
secret across restarts. An explicit `VERISENSE_SECRET` environment value takes
precedence. Use the same persistent volume and make backups.
Source availability switches and verification-call statistics also live under
`/data/sources_state.json`, so the non-root runtime can update them.

## Frontend/backend connection

Build the Sites frontend with `VITE_API_BASE=https://<backend-host>/api`.
Set `VERISENSE_CORS_ORIGINS` on the backend to the exact Sites origin, without
a trailing slash. The current origin is recorded in `render.yaml`.

The app and `/portal/*` deep links can also be served from one Docker service.
`/api/*` and missing asset paths retain genuine 404 responses.

## Local container

```bash
docker compose up --build -d
```

Open `http://localhost:7860`. The named `verisense-data` volume retains changes
between container restarts. The application honours the hosting provider's `PORT`
environment variable. Health check: `/api/health`.

Sources: [Render free limits](https://render.com/docs/free),
[Docker deployment](https://render.com/docs/docker).

## Current deployment gate

See RUNBOOK.md for local and synthetic staging commands, environment guards, backup/rollback and PostgreSQL limitations. compose.staging.yaml is an unverified synthetic SQLite overlay. Production must disable demo mode/autoseeding, provide a strong explicit secret and provision separate accounts. Existing historical hosting instructions do not establish production readiness. See RELEASE_CHECKLIST.md before release.
