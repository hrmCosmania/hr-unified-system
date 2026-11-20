#!/bin/bash
cd "$(dirname "$0")"
echo "===== ดึงงานล่าสุดจาก GitHub ====="
node sync.js pull
echo
read -n 1 -s -r -p "กดปุ่มใดก็ได้เพื่อปิด"
