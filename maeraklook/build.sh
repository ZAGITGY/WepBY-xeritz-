#!/bin/sh
# รวม three.js r187 + ฉาก 3D (src/scene.js) เป็นไฟล์เดียว assets/js/scene.js
# ไม่ต้องใช้ CDN เว็บเปิดจาก zip ได้เลย
# ต้องมี Node.js — ครั้งแรกจะติดตั้ง three r187, gsap 3.15.1, esbuild ไว้ในโฟลเดอร์ .build (ไม่ต้องส่งไปกับเว็บ)
set -e
cd "$(dirname "$0")"
B=.build/node_modules
if [ ! -x "$B/.bin/esbuild" ] || [ ! -d "$B/three" ] || [ ! -d "$B/gsap" ]; then
  mkdir -p .build
  npm install --prefix .build --no-audit --no-fund three@0.187.0 gsap@3.15.1 esbuild@0.28.2
fi
NODE_PATH="$B" "$B/.bin/esbuild" src/scene.js --bundle --minify --format=iife --global-name=MRScene \
  --legal-comments=none --outfile=assets/js/scene.js
cp "$B/gsap/dist/gsap.min.js" "$B/gsap/dist/ScrollTrigger.min.js" assets/js/
echo "build เสร็จ: assets/js/scene.js"
