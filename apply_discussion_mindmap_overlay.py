import os
import re

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

def update_discussion_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    file_dir = os.path.dirname(file_path)
    rel_to_shared = os.path.relpath(os.path.join(ROOT_DIR, "shared"), file_dir).replace("\\", "/")

    css_mindmap = f'    <!-- Portable Discussion Mind Map Overlay -->\n    <link rel="stylesheet" href="{rel_to_shared}/discussion_mindmap.css?v=20261007">'
    css_quiz = f'    <!-- Portable Discussion Quiz Overlay -->\n    <link rel="stylesheet" href="{rel_to_shared}/discussion_quiz.css?v=20261007">'

    # Clean old links without ?v=20261007
    content = re.sub(r'<link\s+rel="stylesheet"\s+href="[^"]*discussion_mindmap\.css(?:\?[^"]*)?">', f'<link rel="stylesheet" href="{rel_to_shared}/discussion_mindmap.css?v=20261007">', content)
    content = re.sub(r'<link\s+rel="stylesheet"\s+href="[^"]*discussion_quiz\.css(?:\?[^"]*)?">', f'<link rel="stylesheet" href="{rel_to_shared}/discussion_quiz.css?v=20261007">', content)

    # Clean scripts with ?v=20261007
    content = re.sub(r'<script\s+src="[^"]*mindmaps_manifest\.js(?:\?[^"]*)?"></script>', f'<script src="{rel_to_shared}/mindmaps_manifest.js?v=20261007"></script>', content)
    content = re.sub(r'<script\s+src="[^"]*discussion_mindmap\.js(?:\?[^"]*)?"></script>', f'<script src="{rel_to_shared}/discussion_mindmap.js?v=20261007"></script>', content)
    content = re.sub(r'<script\s+src="[^"]*discussion_quiz\.js(?:\?[^"]*)?"></script>', f'<script src="{rel_to_shared}/discussion_quiz.js?v=20261007"></script>', content)

    # Ensure CSS exists
    if 'discussion_mindmap.css' not in content:
        if 'github-markdown.min.css">' in content:
            content = content.replace(
                'github-markdown.min.css">\n',
                'github-markdown.min.css">\n' + css_mindmap + '\n'
            )
        elif '</head>' in content:
            content = content.replace('</head>', css_mindmap + '\n</head>')

    if 'discussion_quiz.css' not in content:
        if 'discussion_mindmap.css' in content:
            content = re.sub(
                r'(<link\s+rel="stylesheet"\s+href="[^"]*discussion_mindmap\.css[^"]*">)',
                r'\1\n' + css_quiz,
                content
            )
        elif '</head>' in content:
            content = content.replace('</head>', css_quiz + '\n</head>')

    # Ensure JS scripts exist
    js_stack = f'    <!-- Portable Discussion Mind Map Overlay Engine & Data -->\n    <script src="{rel_to_shared}/mindmaps_manifest.js?v=20261007"></script>\n    <script src="{rel_to_shared}/discussion_mindmap.js?v=20261007"></script>\n    <script src="{rel_to_shared}/discussion_quiz.js?v=20261007"></script>'

    if 'discussion_mindmap.js' not in content:
        if '</body>' in content:
            content = content.replace('</body>', js_stack + '\n</body>')

    if content != original:
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
