#!/usr/bin/env python3
"""
Hugo content pre-processor.
Runs before Hugo build. Applies mechanical transforms to all markdown files:
  1. <img src="/images/*.svg"> → {{< svg "name" >}} shortcode
  2. <img src="/images/*.{gif,png,jpg}"> → wrapped in <div class="svg-diagram">
  3. > [!NOTE] inline text → two-line Hugo GFM alert format
  4. Hard-wrapped paragraph lines → single reflowed lines (mobile-safe)

Planning sections are stripped manually before content reaches git.
This script is idempotent — safe to run on already-processed files.
"""

import re
import os
import glob

CONTENT_DIR = "content"

# ── Helpers ──────────────────────────────────────────────────────────────────

def is_special_line(line):
    """Lines that should NOT be joined with the next line during reflow."""
    s = line.strip()
    if not s:
        return True
    if s.startswith('#'):       return True   # heading
    if s.startswith('>'):       return True   # blockquote / callout
    if s.startswith('- ') or s.startswith('* ') or s.startswith('+ '): return True  # list
    if s.startswith('|'):       return True   # table
    if s.startswith('<'):       return True   # HTML tag
    if s.startswith('{{'):      return True   # Hugo shortcode
    if s.startswith('!'):       return True   # image
    if s.startswith('---') or s.startswith('***') or s.startswith('___'): return True  # hr
    # ordered list: 1. or 1)
    if re.match(r'^\d+[.)]\s', s): return True
    return False

def reflow_paragraphs(content):
    """Join hard-wrapped prose lines within paragraphs into single long lines."""
    lines = content.split('\n')
    result = []
    in_code_block = False
    in_frontmatter = False
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Handle YAML frontmatter
        if i == 0 and stripped == '---':
            in_frontmatter = True
            result.append(line)
            i += 1
            continue
        if in_frontmatter:
            result.append(line)
            if stripped == '---' and i > 0:
                in_frontmatter = False
            i += 1
            continue

        # Track code fences
        if stripped.startswith('```') or stripped.startswith('~~~'):
            in_code_block = not in_code_block
            result.append(line)
            i += 1
            continue

        if in_code_block:
            result.append(line)
            i += 1
            continue

        # Empty line: pass through
        if stripped == '':
            result.append(line)
            i += 1
            continue

        # Special line: pass through as-is
        if is_special_line(line):
            result.append(line)
            i += 1
            continue

        # Regular prose line: collect and join consecutive prose lines
        para = [line.rstrip()]
        i += 1
        while i < len(lines):
            nxt = lines[i]
            nxt_s = nxt.strip()
            if nxt_s == '':
                break
            if nxt_s.startswith('```') or nxt_s.startswith('~~~'):
                break
            if is_special_line(nxt):
                break
            para.append(nxt.rstrip())
            i += 1

        result.append(' '.join(para))

    return '\n'.join(result)

def convert_svg_imgs(content):
    """Replace <img src="/images/name.svg" ...> with {{< svg "name" >}}."""
    return re.sub(
        r'<img\s+src="/images/([^"]+)\.svg"[^>]*/?>',
        lambda m: f'{{{{< svg "{m.group(1)}" >}}}}',
        content
    )

def wrap_raster_imgs(content):
    """Wrap raw <img> tags for raster images (gif/png/jpg) in .svg-diagram box.
    Skips images already wrapped and skips .hero-img."""
    def wrap(m):
        tag = m.group(0)
        # Already wrapped or hero image: leave alone
        if 'class=' in tag and ('svg-diagram' in tag or 'hero-img' in tag):
            return tag
        # Strip width/height attrs — the wrapper CSS handles sizing responsively
        cleaned = re.sub(r'\s+(width|height)="[^"]*"', '', tag)
        return f'<div class="svg-diagram">{cleaned}</div>'

    # Match <img src="/images/*.{gif,png,jpg,jpeg,webp}"> not already inside svg-diagram
    pattern = r'(?<!<div class="svg-diagram">)<img\s+[^>]*src="/images/[^"]+\.(?:gif|png|jpg|jpeg|webp)"[^>]*/?>(?!</div>)'
    return re.sub(pattern, wrap, content, flags=re.IGNORECASE)

def fix_obsidian_callouts(content):
    """Convert `> [!NOTE] inline text` to the two-line Hugo GFM alert format.
    Uses [ \\t]+ (not \\s+) so it never crosses newlines — keeps this idempotent."""
    return re.sub(
        r'^(>[ \t]*)\[!([A-Z]+)\][ \t]+(.+)$',
        lambda m: f'> [!{m.group(2)}]\n> {m.group(3).strip()}',
        content,
        flags=re.MULTILINE
    )

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        original = f.read()

    content = original
    content = convert_svg_imgs(content)
    content = wrap_raster_imgs(content)
    content = fix_obsidian_callouts(content)
    content = reflow_paragraphs(content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  processed: {path}")

def main():
    md_files = glob.glob(os.path.join(CONTENT_DIR, '**', '*.md'), recursive=True)
    print(f"Processing {len(md_files)} markdown files...")
    for path in sorted(md_files):
        process_file(path)
    print("Done.")

if __name__ == '__main__':
    main()
