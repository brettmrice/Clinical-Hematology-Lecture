import os
import json
import math
import re

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(ROOT_DIR, "files_index.json")
JS_FILE = os.path.join(ROOT_DIR, "files_data.js")
VIDEO_CONFIG_FILE = os.path.join(ROOT_DIR, "video_links.json")

EXCLUDED_DIRS = {".git", ".gemini", "node_modules", "__pycache__"}
EXCLUDED_FILES = {
    "generate_index.py",
    "generate_index.js",
    "files_index.json",
    "files_data.js",
    "video_links.json",
    "package.json",
    "package-lock.json",
    ".gitignore",
    "index.html",
    "styles.css",
    "app.js"
}

TOPIC_TITLE_MAP = {
    "L1_Hematopoiesis": "Hematopoiesis",
    "L2_BCE_RBC-HGB": "Erythrocytes & Hemoglobin",
    "L3_BCE_WBC-PLT": "Leukocytes & Platelets",
    "L4_RBC_Analysis": "RBC Analysis"
}

def get_file_type(filename):
    ext = os.path.splitext(filename)[1].lower()
    lower_name = filename.lower()
    if ext == ".pdf":
        return "Slide Deck"
    if "mind_map" in lower_name:
        return "Mind Map"
    if "discussion" in lower_name:
        return "Discussion"
    if ext in [".html", ".htm"]:
        return "HTML Note"
    if ext == ".md":
        return "Markdown Document"
    return "Document"

def get_category(rel_path):
    parts = rel_path.split(os.sep)
    if len(parts) > 1:
        return " / ".join(parts[:-1])
    return "General"

def extract_display_title(full_path, filename, file_type):
    if filename.lower().endswith((".html", ".htm")):
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(2048)
                match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE)
                if match:
                    raw_title = match.group(1).strip()
                    clean = re.sub(r"\s*-\s*(Complete Discussion|Interactive Mind Map|Discussion|Mind Map)$", "", raw_title, flags=re.IGNORECASE).strip()
                    if clean:
                        return clean
        except Exception:
            pass

    for prefix, topic in TOPIC_TITLE_MAP.items():
        if filename.startswith(prefix):
            if file_type in ["Discussion", "Mind Map"]:
                return topic
            m = re.search(r"_S\d+_(.*)\.pdf$", filename, re.IGNORECASE)
            if m:
                return m.group(1).replace("_", " ").replace("-", " & ").strip()

    clean = os.path.splitext(filename)[0]
    clean = re.sub(r"^L\d+_[A-Za-z0-9-]+_S\d+_", "", clean)
    return clean.replace("_", " ").strip()

def format_bytes(size):
    if size == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB")
    i = int(math.floor(math.log(size, 1024)))
    p = math.pow(1024, i)
    s = round(size / p, 1)
    return f"{s} {size_name[i]}"

def load_video_config():
    if os.path.exists(VIDEO_CONFIG_FILE):
        try:
            with open(VIDEO_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print("Error loading video_links.json:", e)
    return []

def scan_dir():
    results = []
    video_configs = load_video_config()
    video_map = {item.get("slide_deck_file"): item for item in video_configs if item.get("slide_deck_file")}

    for root, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        
        for file in files:
            if file in EXCLUDED_FILES:
                continue
            
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, ROOT_DIR)
            
            if rel_path in EXCLUDED_FILES:
                continue
                
            stat = os.stat(full_path)
            file_type = get_file_type(file)
            display_title = extract_display_title(full_path, file, file_type)
            
            item_entry = {
                "name": file,
                "title": display_title,
                "path": rel_path.replace("\\", "/"),
                "size": stat.st_size,
                "sizeFormatted": format_bytes(stat.st_size),
                "extension": os.path.splitext(file)[1].lower().replace(".", ""),
                "type": file_type,
                "category": get_category(rel_path),
                "mtime": stat.st_mtime
            }
            results.append(item_entry)

            # If this file is a Slide Deck and has a video config, generate the associated Video card
            if file in video_map:
                v_info = video_map[file]
                yt_url = v_info.get("youtube_url", "https://www.youtube.com/watch?v=PLACEHOLDER")
                v_title = v_info.get("title", f"{display_title} Overview")
                
                # Derive sort key to keep video placed directly after its corresponding slide deck
                v_sort_name = file.replace(".pdf", "_Video")

                results.append({
                    "name": v_sort_name,
                    "title": v_title,
                    "path": yt_url,
                    "size": 0,
                    "sizeFormatted": "YouTube",
                    "extension": "youtube",
                    "type": "Video",
                    "category": get_category(rel_path),
                    "youtubeUrl": yt_url,
                    "mtime": stat.st_mtime
                })

    return results

if __name__ == "__main__":
    files_data = scan_dir()
    video_configs = load_video_config()
    
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(files_data, f, indent=2)
        
    with open(JS_FILE, "w", encoding="utf-8") as f:
        f.write("window.FILES_DATA = " + json.dumps(files_data, indent=2) + ";\n")

    video_js_file = os.path.join(ROOT_DIR, "video_links.js")
    with open(video_js_file, "w", encoding="utf-8") as f:
        f.write("window.VIDEO_LINKS = " + json.dumps(video_configs, indent=2) + ";\n")
        
    print(f"Successfully indexed {len(files_data)} files and video entries to files_index.json, files_data.js, and video_links.js")
