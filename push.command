#!/bin/bash
cd "$(dirname "$0")"
echo "===== ส่งงานขึ้น GitHub ====="
node sync.js push
echo
read -n 1 -s -r -p "กดปุ่มใดก็ได้เพื่อปิด"
