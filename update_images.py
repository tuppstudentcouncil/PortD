#!/usr/bin/env python3
"""
สคริปต์สำหรับอัปเดตรายชื่อรูปภาพแสดงความยินดีรุ่นพี่อัตโนมัติ
เมื่อมีการเพิ่มรูปภาพใหม่ในโฟลเดอร์ 'แสดงความยินดีรุ่นพี่'
เพียงรันคำสั่ง: python3 update_images.py
ระบบจะอัปเดตไฟล์ congratulations.json ให้อัตโนมัติทันที
"""

import os
import json

FOLDER_NAME = "แสดงความยินดีรุ่นพี่"
OUTPUT_FILE = "congratulations.json"

def main():
    if not os.path.exists(FOLDER_NAME):
        print(f"❌ ไม่พบโฟลเดอร์ {FOLDER_NAME}")
        return

    valid_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    files = [
        f for f in sorted(os.listdir(FOLDER_NAME))
        if not f.startswith(".") and os.path.splitext(f)[1].lower() in valid_extensions
    ]

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(files, f, ensure_ascii=False, indent=2)

    print(f"✅ อัปเดต {OUTPUT_FILE} เรียบร้อยแล้ว! พบรูปภาพทั้งหมด {len(files)} รูป")

if __name__ == "__main__":
    main()
