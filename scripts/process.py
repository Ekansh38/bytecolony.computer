#!/usr/bin/env python3
"""
Hugo content pre-processor.
Runs before Hugo build. Applies mechanical transforms to all markdown files:
  1. <img src="/images/*.svg"> → {{< svg "name" >}} shortcode
  2. <img src="/images/*.{gif,png,jpg}"> → wrapped in <div class="svg-diagram">
  3. > [!NOTE] inline text → two-line Hugo GFM alert format
  4. Hard-wrapped paragraph lines → single reflowed lines (mobile-safe)
  5. Hard-wrapped callout bodies → reflowed too, so hardWraps does not
     freeze the book's line breaks into <br> tags on the page
  6. The Further Reading entries → split into title, author and note, so the
     closing list is set as a list rather than four run-on paragraphs

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

def is_list_item(line):
    """A bullet or numbered item, which may itself be hard-wrapped."""
    return bool(re.match(r'^([-*+]\s|\d+[.)]\s)', line.strip()))

def is_block_start(line):
    """is_special_line, relaxed for a numbered line that cannot actually
    start a list. Goldmark only lets an ordered list interrupt a paragraph
    when it is numbered 1, so a wrapped sentence continuing with "53." is
    still prose and belongs back on the line it was wrapped from."""
    s = line.strip()
    if re.match(r'^\d+[.)]\s', s) and not re.match(r'^1[.)]\s', s):
        return False
    return is_special_line(line)

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

        # A list item can be wrapped too. Its continuation lines are lazy
        # continuations of the same item, so join them onto it; the strict
        # test here keeps the next item in the list from being swallowed.
        if is_list_item(line):
            item = [line.rstrip()]
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if nxt.strip() == '' or is_special_line(nxt):
                    break
                item.append(nxt.strip())
                i += 1
            result.append(' '.join(item))
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
            if is_block_start(nxt):
                break
            para.append(nxt.rstrip())
            i += 1

        result.append(' '.join(para))

    return '\n'.join(result)

def split_glued_code_fences(content):
    """Put an opening ``` fence back on its own line.

    An editing pass upstream sometimes merges the paragraph that introduces a
    code block with the fence that follows it, leaving the ``` at the end of a
    prose line. Markdown then stops seeing a fence there, so the opening one
    renders as literal backticks and the closing one starts a block that
    swallows whatever comes next, diagrams included.
    """
    lines = content.split('\n')
    out = []
    in_code_block = False
    in_frontmatter = False

    for i, line in enumerate(lines):
        stripped = line.strip()

        if i == 0 and stripped == '---':
            in_frontmatter = True
            out.append(line)
            continue
        if in_frontmatter:
            if stripped == '---':
                in_frontmatter = False
            out.append(line)
            continue

        # a fence that already stands alone only toggles the state
        if stripped.startswith('```'):
            in_code_block = not in_code_block
            out.append(line)
            continue

        if in_code_block or '```' not in line:
            out.append(line)
            continue

        # prose with an opening fence glued to the end of it
        idx = line.rfind('```')
        lang = line[idx + 3:].strip()
        if idx > 0 and line[:idx].strip() and line.count('```') == 1 and ' ' not in lang:
            out.append(line[:idx].rstrip())
            out.append('')
            out.append('```' + lang)
            in_code_block = True
            continue

        out.append(line)

    return '\n'.join(out)


def normalize_asset_paths(content):
    """Convert relative `./assets/…` paths to absolute `/assets/…` so Hugo
    serves them correctly from the site root regardless of the article's
    URL depth. Purely a string-level rewrite for src attributes."""
    return re.sub(r'src="\./(assets/[^"]+)"', r'src="/\1"', content)

def convert_svg_imgs(content):
    """Replace <img src="/assets/PATH.svg" ...> with {{< svg "PATH" >}}.
    PATH may contain subdirectories (e.g. "svg/desk") — passed straight
    through to the shortcode which reads static/assets/PATH.svg.
    If the img has a class attribute (e.g. class="small"), pass it as the
    second shortcode arg → {{< svg "PATH" "small" >}}.
    Surrounds output with blank lines so goldmark treats the shortcode as
    a block instead of wrapping in <p> (which breaks caption styling)."""
    def replace(m):
        tag = m.group(0)
        path_stem = m.group(1)   # everything between /assets/ and .svg
        cls_match = re.search(r'class="([^"]+)"', tag)
        alt_match = re.search(r'alt="([^"]*)"', tag)
        cls = cls_match.group(1) if cls_match else ""
        # Alt is carried through as a third arg. Without it the only copy
        # of a diagram in the HTML is the <noscript> fallback, which left
        # every diagram unlabelled for crawlers that do not run JS.
        alt = (alt_match.group(1) if alt_match else "").replace('"', "'")
        if alt:
            return f'\n\n{{{{< svg "{path_stem}" "{cls}" "{alt}" >}}}}\n\n'
        if cls:
            return f'\n\n{{{{< svg "{path_stem}" "{cls}" >}}}}\n\n'
        return f'\n\n{{{{< svg "{path_stem}" >}}}}\n\n'

    result = re.sub(
        r'<img\s+[^>]*src="/assets/([^"]+)\.svg"[^>]*/?>',
        replace,
        content
    )
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result

def wrap_raster_imgs(content):
    """Wrap raw <img> tags for raster images (gif/png/jpg) in .svg-diagram box.
    Skips images already wrapped and skips .hero-img.

    ALSO puts a blank line before the wrapper div and moves the div to its own
    line. This forces goldmark to treat it as block-level HTML (not wrapped in
    a <p>), which preserves the .svg-diagram + p CSS caption selector.
    Without this, an anchor like <a id="diagram-3-5"></a> at the line start
    makes goldmark treat the whole line as a paragraph, producing invalid
    <p><div>...</div></p> that browsers auto-fix by splitting siblings. """
    def wrap(m):
        tag = m.group(0)
        # Already wrapped or hero image: leave alone
        if 'class=' in tag and ('svg-diagram' in tag or 'hero-img' in tag):
            return tag
        # Pick up class="small" (or similar) from the img and pass it to the wrapper
        wrapper_class = 'svg-diagram'
        cls_match = re.search(r'class="([^"]+)"', tag)
        if cls_match:
            wrapper_class = f'svg-diagram {cls_match.group(1)}'
        # Strip width/height/class attrs — the wrapper handles sizing + class
        cleaned = re.sub(r'\s+(width|height|class)="[^"]*"', '', tag)
        # Defer offscreen raster loads (multi-MB of GIFs on the CPU article)
        if 'loading=' not in cleaned:
            cleaned = cleaned.replace('<img ', '<img loading="lazy" decoding="async" ', 1)
        return f'\n\n<div class="{wrapper_class}">{cleaned}</div>\n\n'

    # Match <img src="/assets/*.{gif,png,jpg,jpeg,webp}"> not already inside svg-diagram
    pattern = r'(?<!<div class="svg-diagram">)<img\s+[^>]*src="/assets/[^"]+\.(?:gif|png|jpg|jpeg|webp)"[^>]*/?>(?!</div>)'
    result = re.sub(pattern, wrap, content, flags=re.IGNORECASE)
    # Collapse runs of 3+ newlines that our insertion may have created
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result

def isolate_block_diagrams(content):
    """Make sure diagram wrappers are true block-level HTML that goldmark
    won't wrap inside a <p>. Two steps:
      1. Split mixed lines like `<a id="..."></a> <div class="svg-diagram">...`
         so the anchor is on its own line and the diagram starts a new line.
      2. Ensure blank lines surround any line that begins with a block-level
         diagram (either the .svg-diagram wrapper or a {{< svg >}} shortcode).
    Idempotent: safe to run multiple times."""
    # 1. Split mixed anchor + diagram
    content = re.sub(
        r'(<a id="[^"]+"></a>)[ \t]+(<div class="svg-diagram"[^<]*<img[^>]+></div>|\{\{<\s*svg\b[^}]*>\}\})',
        r'\1\n\n\2',
        content
    )
    # 2. Ensure blank lines before/after any block-diagram line
    lines = content.split('\n')
    out = []
    for i, line in enumerate(lines):
        s = line.strip()
        is_block = s.startswith('<div class="svg-diagram"') or s.startswith('{{< svg')
        if is_block:
            if out and out[-1].strip() != '':
                out.append('')
            out.append(line)
            if i + 1 < len(lines) and lines[i + 1].strip() != '':
                out.append('')
        else:
            out.append(line)
    # Collapse any runs of 3+ blank lines back to 2
    result = '\n'.join(out)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result

def convert_superscripts(content):
    """Convert `X^N` to `X<sup>N</sup>` for nicer math typography.
    Applies outside fenced code blocks AND outside inline code (backticks).
    Handles digits and negative exponents, e.g. `2^2`, `2^32`, `10^-3`."""
    parts = re.split(r'(```[\s\S]*?```)', content)
    out = []
    for i, part in enumerate(parts):
        if i % 2 == 1:  # inside a fenced code block
            out.append(part)
            continue
        subparts = re.split(r'(`[^`]*`)', part)
        for j, sub in enumerate(subparts):
            if j % 2 == 1:  # inside inline code
                out.append(sub)
                continue
            sub = re.sub(r'(\w)\^(-?\w+)', r'\1<sup>\2</sup>', sub)
            out.append(sub)
    return ''.join(out)

def fix_obsidian_callouts(content):
    """Convert `> [!NOTE] inline text` to the two-line Hugo GFM alert format.
    Uses [ \\t]+ (not \\s+) so it never crosses newlines — keeps this idempotent."""
    return re.sub(
        r'^(>[ \t]*)\[!([A-Z]+)\][ \t]+(.+)$',
        lambda m: f'> [!{m.group(2)}]\n> {m.group(3).strip()}',
        content,
        flags=re.MULTILINE
    )

def reflow_callouts(content):
    """Join hard-wrapped lines inside a callout, the way reflow_paragraphs
    does for ordinary prose.

    The source wraps callout bodies at its own column. hardWraps is on, so
    every one of those wrap points would otherwise become a <br> and the
    note would keep the book's line breaks at whatever width the page is.
    The marker line, blank lines between paragraphs, and anything
    is_special_line calls a block of its own are all left alone, so a list
    or a nested quote inside a callout still renders as one.
    """
    lines = content.split('\n')
    out = []
    i = 0

    while i < len(lines):
        if not lines[i].lstrip().startswith('>'):
            out.append(lines[i])
            i += 1
            continue

        # collect the whole run of quoted lines, then reflow it as a unit
        block = []
        while i < len(lines) and lines[i].lstrip().startswith('>'):
            block.append(re.sub(r'^\s*>[ \t]?', '', lines[i]))
            i += 1

        j = 0
        while j < len(block):
            body = block[j]
            stripped = body.strip()
            if stripped == '' or stripped.startswith('[!') or is_special_line(body):
                out.append(('> ' + body).rstrip())
                j += 1
                continue

            para = [body.rstrip()]
            j += 1
            while j < len(block):
                nxt = block[j]
                if nxt.strip() == '' or is_special_line(nxt):
                    break
                para.append(nxt.rstrip())
                j += 1
            out.append('> ' + ' '.join(para))

    return '\n'.join(out)


def swap_gifs_for_webp(content):
    """Serve the animated WebP twin (built by extract_frames.py) instead of
    the GIF — same look, ~60-90% smaller. Only rewrites when the twin
    exists; idempotent. The .gif stays the authoring format."""
    def swap(m):
        name = m.group(1)
        if os.path.exists(f"static/assets/frames-gen/{name}/anim.webp"):
            return f'src="/assets/frames-gen/{name}/anim.webp"'
        return m.group(0)
    return re.sub(r'src="/assets/final/([A-Za-z0-9_-]+)\.gif"', swap, content)

def add_img_dimensions(content):
    """Stamp intrinsic width/height on diagram imgs so the page's layout is
    final before lazy images load. Without this, a jump to a late anchor
    (e.g. the Comments TOC link) lands short: every unloaded image starts
    ~0px tall and the page grows underneath the reader. Idempotent."""
    try:
        from PIL import Image
    except ImportError:
        return content

    def stamp(m):
        tag = m.group(0)
        if 'width=' in tag:
            return tag
        src = m.group(1)
        path = os.path.join("static", src.lstrip("/"))
        if not os.path.exists(path):
            return tag
        try:
            with Image.open(path) as im:
                w, h = im.size
        except Exception:
            return tag
        return tag[:-1].rstrip("/").rstrip() + f' width="{w}" height="{h}">'

    return re.sub(
        r'<img\s+[^>]*src="(/assets/[^"]+\.(?:gif|png|jpg|jpeg|webp))"[^>]*/?>',
        stamp, content, flags=re.IGNORECASE)

def add_lazy_loading(content):
    """Idempotent: give already-wrapped diagram imgs lazy loading attrs."""
    return re.sub(
        r'(<div class="svg-diagram[^"]*"><img )(?!loading=)',
        r'\1loading="lazy" decoding="async" ',
        content)

def structure_further_reading(content):
    """Give the closing Further Reading list the shape a reading list has on
    the web rather than the one it has in print.

    In the book each entry is a single run-on paragraph: an italic title, the
    author, then the annotation. That reads fine on paper and badly on a
    screen, where nothing tells the four entries apart but a paragraph break.
    Each one is split into its title, its author and its note so the list can
    be set as a list.

    An entry that does not parse is left exactly as it was, so it still
    renders as an ordinary paragraph inside the section. Idempotent: the
    wrapper is the marker.
    """
    if 'class="reading-list"' in content:
        return content

    m = re.search(r'^## Further Reading[ \t]*$', content, re.M)
    if not m:
        return content

    head, body = content[:m.end()], content[m.end():]

    # The author ends at the first ". " that is not a middle initial, so
    # "Tony R. Kuphaldt. A textbook" breaks after Kuphaldt and not after R.
    entry = re.compile(
        r'^\*(?P<title>[^*]+)\*'
        r'(?P<alt>\s*\([^)]+\))?'
        r'\s+by\s+(?P<author>.+?)(?<!\s[A-Z])\.\s+'
        r'(?P<note>\S.*)$'
    )

    out = []
    for para in body.split('\n'):
        hit = entry.match(para.strip()) if para.strip() else None
        if not hit:
            out.append(para)
            continue
        alt = hit.group('alt')
        alt = f' <span class="reading-alt">{alt.strip()}</span>' if alt else ''
        out.append(
            '<div class="reading-item">\n'
            f'<div class="reading-title">{hit.group("title")}{alt}</div>\n'
            f'<div class="reading-author">{hit.group("author")}</div>\n'
            '<div class="reading-note">\n'
            '\n'
            f'{hit.group("note")}\n'
            '\n'
            '</div>\n'
            '</div>'
        )

    body = '\n'.join(out)
    body = re.sub(r'\n{3,}', '\n\n', body)
    return head + '\n\n<div class="reading-list">\n' + body.lstrip('\n') + '\n</div>\n'

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        original = f.read()

    content = original
    content = split_glued_code_fences(content)
    content = normalize_asset_paths(content)
    content = convert_svg_imgs(content)
    content = wrap_raster_imgs(content)
    content = swap_gifs_for_webp(content)
    content = add_lazy_loading(content)
    content = add_img_dimensions(content)
    content = isolate_block_diagrams(content)
    content = convert_superscripts(content)
    content = fix_obsidian_callouts(content)
    content = reflow_callouts(content)
    content = reflow_paragraphs(content)
    content = structure_further_reading(content)

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
