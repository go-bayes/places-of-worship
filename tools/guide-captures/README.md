# guide capture suite

playwright walkthrough recorder behind apps/guides/. setup:

    cd tools/guide-captures && npm init -y && npm i playwright && npx playwright install chromium
    python3 -m http.server 8000 --directory ../..   # repo root; 8000 is on the tile worker's cors list, so dots draw
    node capture.mjs [flow_id]                      # no arg = all ten flows

outputs per-flow pngs + webm; convert mp4: ffmpeg h264 yuv420p faststart -crf 18.
media uploads to r2 bucket pow-guides-media (public base
https://pub-7ea3480b1cda47698311dce4dbab438c.r2.dev); the guide pages in
apps/guides/ reference those keys. crop rule for panel frames whose right
40% is blank white: crop to left 1280px, save as <name>-crop.png.
