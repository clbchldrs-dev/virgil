# Personality workbook → DOCX

Builds [`docs/personality/Virgil_personality_synthesis.docx`](../docs/personality/Virgil_personality_synthesis.docx) from [`docs/personality/Virgil_personality_synthesis.md`](../docs/personality/Virgil_personality_synthesis.md).

## Prerequisites

Python 3.11+ and `python-docx`:

```bash
pip install -r scripts/requirements-personality-docx.txt
```

## Regenerate

From the repository root:

```bash
python3 scripts/gen-personality-docx.py
```

Edit the Markdown file for git-friendly diffs; regenerate the Word file when prompts or workbook structure change.

## Alternative

If you have [Pandoc](https://pandoc.org/) installed:

```bash
pandoc docs/personality/Virgil_personality_synthesis.md -o docs/personality/Virgil_personality_synthesis.docx
```

Formatting may differ slightly from the Python script (tables, code blocks).
