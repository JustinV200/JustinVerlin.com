# Split markdown content into chunks based on ## headings.
import re

#take in the content of a markdown file and split it into chunks based on ## headings, returning a list of (section_name, chunk_text) tuples
def chunk_file(content: str) -> list[tuple[str, str]]:
    parts = re.split(r'(?=^## )', content, flags=re.MULTILINE)
    result = []
    #for each part, get the first line as the section name and the whole part as the chunk text
    for part in parts:
        part = part.strip()
        if not part:
            continue
        first_line = part.splitlines()[0]
        section = first_line.lstrip('#').strip()
        result.append((section, part))
    return result
