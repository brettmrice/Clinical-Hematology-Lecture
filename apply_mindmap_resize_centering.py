import os
import glob

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

TARGET_SNIPPET = """    window.addEventListener('mouseup', () => { isDragging = false; });

    // Adjust viewing center point on window resize
    let prevWindowWidth = window.innerWidth;
    let prevWindowHeight = window.innerHeight;
    window.addEventListener('resize', () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;
      const deltaW = currentWidth - prevWindowWidth;
      const deltaH = currentHeight - prevWindowHeight;
      prevWindowWidth = currentWidth;
      prevWindowHeight = currentHeight;

      translateX += deltaW / 2;
      translateY += deltaH / 2;
      updateTransform(false);
    });"""

def update_mindmap_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if "Adjust viewing center point on window resize" in content:
        return False, "Already updated"

    pattern = "window.addEventListener('mouseup', () => { isDragging = false; });"
    if pattern in content:
        new_content = content.replace(pattern, TARGET_SNIPPET)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True, "Updated successfully"
    else:
        return False, "Pattern not found"

def main():
    mindmap_files = (
        glob.glob(os.path.join(ROOT_DIR, 'Lecture', '**', '*Mind_Map*.html'), recursive=True) +
        glob.glob(os.path.join(ROOT_DIR, 'Laboratory', '**', '*Mind_Map*.html'), recursive=True)
    )

    print(f"Found {len(mindmap_files)} Mind Map files.")
    updated_count = 0
    for fpath in mindmap_files:
        rel_path = os.path.relpath(fpath, ROOT_DIR)
        success, msg = update_mindmap_file(fpath)
        if success:
            updated_count += 1
            print(f"[UPDATED] {rel_path}")
        else:
            print(f"[SKIPPED] {rel_path} ({msg})")

    print(f"\nDone. Updated {updated_count}/{len(mindmap_files)} files.")

if __name__ == '__main__':
    main()
