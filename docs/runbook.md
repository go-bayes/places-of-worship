# Operations Runbook

This runbook covers routine operational tasks for the current production stack.
It assumes the static frontend is hosted on GitHub Pages and tiles are served by
Martin running in Docker on a Google VM.

## Quick Architecture
- Frontend: GitHub Pages, entry point `apps/global/index.html`.
- Basemap: MapTiler Cloud styles (CARTO Light fallback).
- Data tiles: Martin on GCP VM, serving from `/srv/tiles`.
- Street View: Google Maps JS API in popups.
- DNS:
  - `www.placesmap.org` + `placesmap.org` -> GitHub Pages.
  - `tiles.placemap.org` -> GCP VM (Martin).

## Routine Checks
- Confirm `https://www.placesmap.org` loads the global map.
- Confirm `https://www.placesmap.org/enhanced-places.html` loads the NZ app.
- Confirm `https://tiles.placemap.org` responds for tile requests.
- Verify Street View popups load on desktop and link-only on mobile.

## DNS Records (redacted)

Keep DNS records in a private ops note (git-ignored). At most, note the record
*types* (A/CNAME) and hostnames:

### placemap.org (tiles)
- `tiles.placemap.org` A -> <GCP_VM_IP>
- `www.placemap.org` A -> <HOST_IP>

### placesmap.org (site)
- `placesmap.org` A -> <GITHUB_PAGES_IPS>
- `www.placesmap.org` CNAME -> `go-bayes.github.io`

## Frontend Deployment (GitHub Pages)
1. Update files under `apps/` and commit to the default branch.
2. GitHub Pages publishes from the repository (confirm settings in GitHub).
3. Validate:
   - `https://www.placesmap.org` loads `apps/global/index.html`.
   - `https://www.placesmap.org/enhanced-places.html` redirects to
     `apps/regions/nz/`.

## Updating Basemap or Street View Keys
- Keys are stored in `apps/global/config.public.js`.
- Update the key, commit, and publish via GitHub Pages.
- Avoid committing private keys; keep only public client keys in-repo.

## Tile Pipeline (Local -> GCS -> VM)
1. Generate `.mbtiles` or `.pmtiles` locally (Tippecanoe).
2. Upload to Google Cloud Storage bucket.
3. Sync tiles down to the VM at `/srv/tiles`.
4. Restart or reload the Martin container if needed.

### Step-by-Step (annotated)
Use this for a full tile refresh when you are tired or returning after a break.

1) Build tiles locally
- Run Tippecanoe to generate `.mbtiles`/`.pmtiles`.
- Keep the outputs together in a staging folder (example: `data_temp/`).

2) Upload to Google Cloud Storage
- Use your standard GCS upload method (manual console upload or `gsutil`).
- Confirm the upload date and object sizes match the local files.

3) Sync tiles onto the VM
- Copy from GCS to the VM directory `/srv/tiles`.
- Confirm the tiles exist on the VM with `ls -lh /srv/tiles`.

4) Restart Martin
- Restart the container and check logs for errors.
- Validate a known tile URL in the browser.

Keep a short note in `CHANGELOG.md` after each tile update (date + datasets).

## Forensics Checklist (if something breaks)

These are the minimum facts to capture for future diagnosis:

### DNS & Routing
- Current DNS provider and domain registrar (keep in private notes).
- Record set for `www.placesmap.org`, `placesmap.org`, and `tiles.placemap.org`.
- Any recent record changes (date/time + who made the change).

### Hosting
- GitHub Pages settings (source branch + custom domain + HTTPS).
- VM instance name + zone, and whether it is running.
- Firewall rules allowing inbound traffic on port `3000` for Martin.

### Storage
- GCS bucket name + region (redact if needed in public docs).
- The most recent tile upload timestamp.
- VM directory contents under `/srv/tiles`.

### Martin Runtime
- Container name, image tag, and port mapping.
- Container start command (CLI args).
- Recent logs around the failure time.

### Frontend
- `apps/global/config.public.js` keys and allowed origins.
- The exact URL that failed (copy/paste).
- Browser console error text.

## Martin (Tile Server) Operations

### SSH Access (fill in)
- Host: <GCP_VM_HOSTNAME_OR_IP>
- Zone/Project: <GCP_PROJECT>/<ZONE>
- SSH command: <ssh-command>

### VM Profile (current)
- Name: instance-template-<redacted>
- Zone: australia-southeast2-a
- OS image: debian-12-bookworm-v20251209 (x86_64)
- Machine type: e2-small (2 vCPU, 2 GB RAM)
- Disk: 10 GB balanced persistent disk
- Service account: tiles-reader@places-of-worship<redacted>.iam.gserviceaccount.com
- Storage scope: read-only

### Container Details (fill in)
- Docker image: `ghcr.io/maplibre/martin:latest`
- Container name: `magical_satoshi`
- Config path: none (Martin launched with CLI args)
- Ports: `3000:3000` (TCP)

### Check Ports (example)
```bash
docker port magical_satoshi
```

### Current Martin Command
Martin is started with the tile directory mounted at `/tiles`.
```bash
docker inspect magical_satoshi --format '{{json .Config.Cmd}}'
# ["-l","0.0.0.0:3000","/tiles"]
```

### Current Volume Mount
```bash
docker inspect magical_satoshi --format '{{json .Mounts}}'
# [{"Type":"bind","Source":"/srv/tiles","Destination":"/tiles",...}]
```

### Tile Source Config (example)
Store this config on the VM (or in a mounted volume) and point Martin at it.
```json
{
  "tiles": {
    "buildings": {
      "content_type": "application/x-protobuf",
      "content_encoding": "gzip",
      "name": "<path-to>/buildings.mbtiles",
      "description": "<path-to>/buildings.mbtiles"
    },
    "nz-polygons": {
      "content_type": "application/x-protobuf",
      "content_encoding": "gzip",
      "name": "<path-to>/nz-polygons.pmtiles",
      "description": "<path-to>/nz-polygons.pmtiles"
    },
    "places-overview": {
      "content_type": "application/x-protobuf",
      "content_encoding": "gzip",
      "name": "places-overview.mbtiles",
      "description": "places-overview.mbtiles"
    },
    "places": {
      "content_type": "application/x-protobuf",
      "content_encoding": "gzip",
      "name": "places.mbtiles",
      "description": "places.mbtiles"
    }
  },
  "sprites": {},
  "fonts": {},
  "styles": {}
}
```

### Restart Martin (example)
```bash
# replace placeholders with actual values
ssh <vm> "docker restart magical_satoshi"
```

### Inspect Logs (example)
```bash
ssh <vm> "docker logs --tail=200 magical_satoshi"
```

## Troubleshooting

### Tiles not loading
- Check `https://tiles.placemap.org` DNS and VM reachability.
- Ensure `/srv/tiles` contains the expected `.mbtiles`/`.pmtiles`.
- Confirm Martin container is running and serving the expected port.

### Basemap fails
- Verify MapTiler API key in `apps/global/config.public.js`.
- Confirm MapTiler service availability.
- Confirm CARTO fallback URL is still valid.

### Street View missing
- Verify Google Maps JS API key in `apps/global/config.public.js`.
- Confirm billing/quotas on the Google Maps project.
- Check browser console for API errors.

## Change Tracking
- Record operational changes in `CHANGELOG.md`.
- Record strategic decisions in `PLANNING.md`.
