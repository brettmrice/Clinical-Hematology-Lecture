import os
import json
import math

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(ROOT_DIR, "files_index.json")
JS_FILE = os.path.join(ROOT_DIR, "files_data.js")

EXCLUDED_DIRS = {".git", ".gemini", "node_modules", "__pycache__"}
EXCLUDED_FILES = {
    "generate_index.py",
    "generate_index.js",
    "files_index.json",
    "files_data.js",
    "package.json",
    "package-lock.json",
    ".gitignore",
    "index.html",
    "styles.css",
    "app.js"
}

def get_file_type(filename):
    ext = os.path.splitext(filename)[1].lower()
    lower_name = filename.lower()
    if ext == ".pdf":
        return "PDF Slide"
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

def format_bytes(size):
    if size == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB")
    i = int(math.floor(math.log(size, 1024)))
    p = math.pow(1024, i)
    s = round(size / p, 1)
    return f"{s} {size_name[i]}"

def scan_dir():
    results = []
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
            
            results.append({
                "name": file,
                "path": rel_path.replace("\\", "/"),
                "size": stat.st_size,
                "sizeFormatted": format_bytes(stat.st_size),
                "extension": os.path.splitext(file)[1].lower().replace(".", ""),
                "type": get_file_type(file),
                "category": get_category(rel_path),
                "mtime": stat.st_mtime
            })
    return results

if __name__ == "__main__":
    files_data = scan_dir()
    
    # Write JSON manifest
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(files_data, f, indent=2)
        
    # Write JS file manifest for file:// protocol compatibility without CORS restriction
    with open(JS_FILE, "w", encoding="utf-8") as f:
        f.write("window.FILES_DATA = " + json.dumps(files_data, indent=2) + ";\n")
        
    print(f"Successfully indexed {len(files_data)} files to files_index.json and files_data.js")
