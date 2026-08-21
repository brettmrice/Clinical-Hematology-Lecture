import os
import json
import math
import re

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(ROOT_DIR, "files_index.json")
JS_FILE = os.path.join(ROOT_DIR, "files_data.js")
VIDEO_CONFIG_FILE = os.path.join(ROOT_DIR, "video_links.json")

EXCLUDED_DIRS = {".git", ".gemini", "node_modules", "__pycache__", "scratch"}
EXCLUDED_FILES = {
    "generate_index.py",
    "generate_index.js",
    "files_index.json",
    "files_data.js",
    "video_links.json",
    "video_links.js",
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
    "L4_RBC_Analysis": "RBC Analysis",
    "L1_Manual_Counts": "Manual Counts",
    "L2_Slide_Preparation": "Slide Preparation",
    "L3_Slide_Evaluation": "Slide Evaluation",
    "L4_CBC_Analysis": "CBC Analysis"
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
            m = re.search(r"_S\d+_+(.*)\.pdf$", filename, re.IGNORECASE)
            if m:
                return m.group(1).replace("_", " ").replace("-", " & ").strip()

    clean = os.path.splitext(filename)[0]
    clean = re.sub(r"^L\d+_[A-Za-z0-9_-]+?_S\d+_?", "", clean)
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
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception as e:
            print("Error loading video_links.json:", e)
    return []

def sync_video_configs(scanned_slide_decks):
    """
    Ensures 1:1 mapping between slide decks and video entries in video_links.json.
    Preserves all existing entries (including manual demonstrations) in their authored order,
    and appends any newly discovered slide decks.
    """
    existing_configs = load_video_config()
    existing_by_deck = {item["slide_deck_file"]: item for item in existing_configs if item.get("slide_deck_file")}
    
    missing_decks = [deck for deck in scanned_slide_decks if deck["name"] not in existing_by_deck]

    if not existing_configs:
        updated_configs = []
        for deck in scanned_slide_decks:
            updated_configs.append({
                "slide_deck_file": deck["name"],
                "title": deck["title"],
                "youtube_url": "https://youtu.be/PLACEHOLDER"
            })
    else:
        updated_configs = list(existing_configs)
        for deck in missing_decks:
            updated_configs.append({
                "slide_deck_file": deck["name"],
                "title": deck["title"],
                "youtube_url": "https://youtu.be/PLACEHOLDER"
            })

    try:
        with open(VIDEO_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(updated_configs, f, indent=2)
    except Exception as e:
        print("Error saving updated video_links.json:", e)

    return updated_configs

def scan_dir():
    raw_files = []
    scanned_slide_decks = []
    deck_category_map = {}

    target_dirs = ["Laboratory", "Lecture"]

    for target in target_dirs:
        target_path = os.path.join(ROOT_DIR, target)
        if not os.path.exists(target_path):
            continue

        for root, dirs, files in os.walk(target_path):
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
                cat = get_category(rel_path)
                
                item_entry = {
                    "name": file,
                    "title": display_title,
                    "path": rel_path.replace("\\", "/"),
                    "size": stat.st_size,
                    "sizeFormatted": format_bytes(stat.st_size),
                    "extension": os.path.splitext(file)[1].lower().replace(".", ""),
                    "type": file_type,
                    "category": cat,
                    "mtime": stat.st_mtime
                }
                raw_files.append(item_entry)

                if file_type == "Slide Deck" or file.lower().endswith(".pdf"):
                    scanned_slide_decks.append(item_entry)
                    deck_category_map[file] = cat

    # Sort slide decks naturally
    scanned_slide_decks.sort(key=lambda x: x["name"])

    # Update and sync video_links.json
    video_configs = sync_video_configs(scanned_slide_decks)

    results = list(raw_files)
    
    current_cat = "General"
    current_deck_prefix = ""
    demo_counter = 0
    tool_counter = 0

    for item in video_configs:
        deck_file = item.get("slide_deck_file")
        target_url = item.get("url") or item.get("youtube_url") or "https://youtu.be/PLACEHOLDER"
        v_title = item.get("title", "Video")

        if deck_file:
            current_cat = deck_category_map.get(deck_file, "General")
            m = re.match(r"^(L\d+_[A-Za-z0-9_-]+?)(?:_S\d+|$)", deck_file)
            current_deck_prefix = m.group(1) if m else os.path.splitext(deck_file)[0]
            
            v_sort_name = deck_file.replace(".pdf", "_Video")
            results.append({
                "name": v_sort_name,
                "title": v_title,
                "path": target_url,
                "size": 0,
                "sizeFormatted": "YouTube" if "youtu" in target_url else "Web",
                "extension": "youtube" if "youtu" in target_url else "url",
                "type": "Video",
                "category": current_cat,
                "youtubeUrl": target_url,
                "mtime": 0
            })
        elif "tool" in item:
            # Tool entry
            tool_counter += 1
            descriptor = item["tool"]
            m = re.match(r"^(L\d+_[A-Za-z0-9_-]+?)(?:_S\d+|_|$)", descriptor)
            prefix = m.group(1) if m else (current_deck_prefix if current_deck_prefix else "Tool")
            clean_title_slug = re.sub(r"[^a-zA-Z0-9_]+", "_", v_title).strip("_")
            tool_name = f"{descriptor}_Tool_{clean_title_slug}"

            cat = item.get("category")
            if not cat:
                is_lab = prefix.startswith("L") and any(k in prefix for k in ["Manual_Counts", "Slide_Prep", "Slide_Eval"])
                cat = "Laboratory / CBC_PBS" if is_lab else current_cat

            results.append({
                "name": tool_name,
                "title": v_title,
                "path": target_url,
                "size": 0,
                "sizeFormatted": "Web Tool",
                "extension": "url",
                "type": "Tool",
                "category": cat,
                "youtubeUrl": target_url,
                "mtime": 0
            })
        else:
            # Demonstration entry
            demo_counter += 1
            descriptor = item.get("demo", f"Demo_{demo_counter}")
            m = re.match(r"^(L\d+_[A-Za-z0-9_-]+?)(?:_S\d+|_|$)", str(descriptor))
            prefix = m.group(1) if m else (current_deck_prefix if current_deck_prefix else "Demonstration")
            clean_title_slug = re.sub(r"[^a-zA-Z0-9_]+", "_", v_title).strip("_")
            demo_name = f"{descriptor}_Demo_{clean_title_slug}"

            cat = item.get("category")
            if not cat:
                is_lab = prefix.startswith("L") and any(k in prefix for k in ["Manual_Counts", "Slide_Prep", "Slide_Eval"])
                cat = "Laboratory / CBC_PBS" if is_lab else current_cat

            results.append({
                "name": demo_name,
                "title": v_title,
                "path": target_url,
                "size": 0,
                "sizeFormatted": "YouTube" if "youtu" in target_url else "Web",
                "extension": "youtube" if "youtu" in target_url else "url",
                "type": "Demonstration",
                "category": cat,
                "youtubeUrl": target_url,
                "mtime": 0
            })

    return results, video_configs

if __name__ == "__main__":
    files_data, video_configs = scan_dir()
    
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(files_data, f, indent=2)
        
    with open(JS_FILE, "w", encoding="utf-8") as f:
        f.write("window.FILES_DATA = " + json.dumps(files_data, indent=2) + ";\n")

    video_js_file = os.path.join(ROOT_DIR, "video_links.js")
    with open(video_js_file, "w", encoding="utf-8") as f:
        f.write("window.VIDEO_LINKS = " + json.dumps(video_configs, indent=2) + ";\n")
        
    print(f"Successfully synced video_links.json ({len(video_configs)} entries) and indexed {len(files_data)} files to files_index.json, files_data.js, and video_links.js")
