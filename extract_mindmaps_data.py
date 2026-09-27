import os
import re
import json

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

def extract_mindmap_data(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match `const mindMapData = { ... };`
    match = re.search(r'const\s+mindMapData\s*=\s*(\{[\s\S]*?\n\s*\});', content)
    if not match:
        return None

    raw_js = match.group(1)
    
    try:
        return json.loads(raw_js)
    except Exception:
        cleaned = re.sub(r',\s*([\]}])', r'\1', raw_js)
        try:
            return json.loads(cleaned)
        except Exception as e:
            print(f"Error parsing JSON from {file_path}: {e}")
            return None

def main():
    mindmap_data_map = {}
    
    for folder in ['Lecture', 'Laboratory']:
        folder_path = os.path.join(ROOT_DIR, folder)
        if not os.path.exists(folder_path):
            continue
        for root, _, files in os.walk(folder_path):
            subfolder = os.path.relpath(root, folder_path).replace('\\', '/')
            if subfolder == '.':
                subfolder = ''
                
            for file in files:
                if file.endswith('_Mind_Map.html'):
                    file_path = os.path.join(root, file)
                    data = extract_mindmap_data(file_path)
                    if data:
                        base_name = file.replace('.html', '')
                        prefix_match = re.match(r'^(L\d+_[^_]+(?:_[^_]+)*?)_S\d+_', base_name)
                        if prefix_match:
                            lesson_key = prefix_match.group(1)
                        else:
                            lesson_key = base_name.replace('_Mind_Map', '')
                        
                        rel_path = os.path.relpath(file_path, ROOT_DIR).replace('\\', '/')
                        
                        entry = {
                            "id": base_name,
                            "folder": folder,
                            "subfolder": subfolder,
                            "lessonKey": lesson_key,
                            "title": data.get("text", lesson_key),
                            "file": rel_path,
                            "data": data
                        }
                        
                        # Store by multiple granular keys to guarantee exact collision-free matching
                        full_key = f"{folder.lower()}/{subfolder.lower()}/{lesson_key.lower()}".replace('//', '/')
                        folder_lesson_key = f"{folder.lower()}/{lesson_key.lower()}"
                        
                        mindmap_data_map[full_key] = entry
                        mindmap_data_map[folder_lesson_key] = entry
                        mindmap_data_map[f"{folder.lower()}/{base_name.lower()}"] = entry
                        mindmap_data_map[rel_path.lower()] = entry
                        
                        # Fallbacks
                        if lesson_key not in mindmap_data_map:
                            mindmap_data_map[lesson_key] = entry
                        if base_name not in mindmap_data_map:
                            mindmap_data_map[base_name] = entry

    shared_dir = os.path.join(ROOT_DIR, 'shared')
    os.makedirs(shared_dir, exist_ok=True)
    
    json_path = os.path.join(shared_dir, 'course_mindmaps_data.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(mindmap_data_map, f, indent=2)
    
    js_path = os.path.join(shared_dir, 'course_mindmaps_data.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated Consolidated Course Mind Maps Data\n')
        f.write('window.COURSE_MINDMAPS_DATA = ')
        json.dump(mindmap_data_map, f, indent=2)
        f.write(';\n')
        
    unique_count = len(set(v['file'] for v in mindmap_data_map.values()))
    print(f"Extracted {unique_count} distinct mind map files into {json_path} and {js_path}.")

if __name__ == '__main__':
    main()
