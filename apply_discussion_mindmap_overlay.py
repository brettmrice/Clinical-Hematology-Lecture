import os
import re

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

CSS_TAG = '    <!-- Portable Discussion Mind Map Overlay -->\n    <link rel="stylesheet" href="../../shared/discussion_mindmap.css">'
JS_TAGS = '    <!-- Portable Discussion Mind Map Overlay Engine & Data -->\n    <script src="../../shared/mindmaps_manifest.js"></script>\n    <script src="../../shared/discussion_mindmap.js"></script>'

def update_discussion_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = False

    # Check CSS
    if 'discussion_mindmap.css' not in content:
        if 'github-markdown.min.css">' in content:
            content = content.replace(
                'github-markdown.min.css">\n',
                'github-markdown.min.css">\n' + CSS_TAG + '\n'
            )
            modified = True
        elif '</head>' in content:
            content = content.replace('</head>', CSS_TAG + '\n</head>')
            modified = True

    # Migrate course_mindmaps_data.js to mindmaps_manifest.js
    if 'course_mindmaps_data.js' in content:
        content = content.replace(
            '<script src="../../shared/course_mindmaps_data.js"></script>',
            '<script src="../../shared/mindmaps_manifest.js"></script>'
        )
        content = re.sub(
            r'<script\s+src="[^"]*course_mindmaps_data\.js"></script>',
            '<script src="../../shared/mindmaps_manifest.js"></script>',
            content
        )
        modified = True

    if 'mindmaps_manifest.js' not in content and 'discussion_mindmap.js' in content:
        content = re.sub(
            r'<script\s+src="[^"]*discussion_mindmap\.js"></script>',
            '<script src="../../shared/mindmaps_manifest.js"></script>\n    <script src="../../shared/discussion_mindmap.js"></script>',
            content
        )
        modified = True
    elif 'discussion_mindmap.js' not in content:
        if '</body>' in content:
            content = content.replace('</body>', JS_TAGS + '\n</body>')
            modified = True

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    count = 0
    updated = 0
    for folder in ['Lecture', 'Laboratory']:
        folder_path = os.path.join(ROOT_DIR, folder)
        if not os.path.exists(folder_path):
            continue
        for root, _, files in os.walk(folder_path):
            for file in files:
                if file.endswith('_Discussion.html'):
                    count += 1
                    file_path = os.path.join(root, file)
                    if update_discussion_file(file_path):
                        print(f"Updated: {os.path.relpath(file_path, ROOT_DIR)}")
                        updated += 1
                    else:
                        print(f"Verified: {os.path.relpath(file_path, ROOT_DIR)}")

    print(f"\nDone! Processed {count} discussions ({updated} updated).")

if __name__ == '__main__':
    main()
