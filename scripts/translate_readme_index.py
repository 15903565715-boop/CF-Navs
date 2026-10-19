#!/usr/bin/env python3
"""Translate README.md via Bilibili's free Index-Translate API.

Official free endpoint: https://index-translate.bilibili.com/v1 (OpenAI-compatible,
no API key required). The model emits chain-of-thought unless the hidden
``chat_template_kwargs.enable_thinking=false`` parameter is sent, so every request
carries it (plus a defensive <think> stripper as a safety net).

Usage:
    python scripts/translate_readme_index.py --lang en
    python scripts/translate_readme_index.py --lang en --preview   # first chunk only
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit, urlunsplit

API_BASE = os.environ.get("INDEX_TRANSLATE_API_BASE", "https://index-translate.bilibili.com/v1")
MODEL = os.environ.get("INDEX_TRANSLATE_MODEL", "Index-Translate-35B-A3B")
SOURCE = "README.md"

LANG_NAMES = {"en": "English", "zh": "Chinese", "ja": "Japanese"}
FENCED_BLOCK_RE = re.compile(
    r"(?ms)(^[ \t]*(?:```|~~~)[^\n]*\n.*?^[ \t]*(?:```|~~~)[ \t]*$)"
)
HTML_LINK_RE = re.compile(
    r"(?P<prefix>\b(?:href|src)\s*=\s*[\"'])(?P<target>[^\"']+)(?P<suffix>[\"'])",
    re.IGNORECASE,
)
MARKDOWN_LINK_RE = re.compile(
    r"(?P<prefix>!?\[[^\]]*\]\()(?P<target><[^>]+>|[^)\s]+)(?P<suffix>[^)]*\))"
)


def split_chunks(text):
    """Split markdown by '## ' section headers; preamble becomes chunk 0."""
    parts = re.split(r"(?m)^(?=## )", text)
    return [p for p in parts if p.strip()]


def build_prompt(chunk, target):
    tgt = LANG_NAMES.get(target, target)
    return (
        "Translate the following Markdown document fragment from Chinese to " + tgt + ". Rules:\n"
        "1. Keep Markdown formatting (headings, lists, tables, quotes, bold) unchanged;\n"
        "2. Keep fenced code blocks and inline code exactly as-is, do not translate;\n"
        "3. For links, translate only the display text, keep URLs unchanged; "
        "image alt text may be translated, src stays;\n"
        "4. Keep HTML tags and attributes as-is, translate only Chinese text inside tags;\n"
        "5. Output only the translation, no explanations.\n\n"
        "[Content to translate]\n" + chunk.strip()
    )


def strip_think(text):
    if "</think>" in text:
        text = text.split("</think>", 1)[1]
    return text.strip().removeprefix("<think>").strip()


def _rewrite_relative_target(target, source_path, output_path):
    """Resolve a source-relative link from the translated file's directory."""
    wrapped = target.startswith("<") and target.endswith(">")
    raw_target = target[1:-1] if wrapped else target
    parsed = urlsplit(raw_target)
    if (
        not parsed.path
        or parsed.scheme
        or parsed.netloc
        or parsed.path.startswith(("/", "//"))
    ):
        return target

    source_path = os.path.normpath(source_path)
    output_path = os.path.normpath(output_path)
    source_dir = os.path.dirname(source_path) or "."
    output_dir = os.path.dirname(output_path) or "."
    source_target = os.path.normpath(
        os.path.join(source_dir, parsed.path.replace("/", os.sep))
    )

    # A translated README's language switch should point back to its source,
    # not back to the translated file that the source README links to.
    if os.path.normcase(source_target) == os.path.normcase(output_path):
        resolved = os.path.relpath(source_path, output_dir)
    else:
        resolved = os.path.relpath(source_target, output_dir)
    resolved = resolved.replace(os.sep, "/")
    if parsed.path.endswith("/") and not resolved.endswith("/"):
        resolved += "/"

    rewritten = urlunsplit(("", "", resolved, parsed.query, parsed.fragment))
    return "<" + rewritten + ">" if wrapped else rewritten


def rewrite_relative_links(text, source_path, output_path):
    """Rewrite links for a translated output path, excluding fenced code."""
    def rewrite_segment(segment):
        def rewrite_html(match):
            target = _rewrite_relative_target(
                match.group("target"), source_path, output_path
            )
            return match.group("prefix") + target + match.group("suffix")

        def rewrite_markdown(match):
            target = _rewrite_relative_target(
                match.group("target"), source_path, output_path
            )
            return match.group("prefix") + target + match.group("suffix")

        segment = HTML_LINK_RE.sub(rewrite_html, segment)
        return MARKDOWN_LINK_RE.sub(rewrite_markdown, segment)

    parts = FENCED_BLOCK_RE.split(text)
    return "".join(
        part if index % 2 else rewrite_segment(part)
        for index, part in enumerate(parts)
    )


def rewrite_language_switch(text, target, source_path, output_path):
    """Make the translated README's language link point back to Chinese."""
    if target != "en":
        return text
    source_link = _rewrite_relative_target("README.md", source_path, output_path)
    return re.sub(
        r"(?m)^\*\*Languages:\*\*[^\n]*$",
        "**Languages:** [简体中文](%s)" % source_link,
        text,
        count=1,
    )


def translate_chunk(chunk, target, retries=3):
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": build_prompt(chunk, target)}],
        "temperature": 0.0,
        "max_tokens": max(2048, len(chunk) * 2),
        "stream": False,
        # Hidden param: keeps reasoning OFF. Without it the model emits a long
        # chain-of-thought before the translation.
        "chat_template_kwargs": {"enable_thinking": False},
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                API_BASE.rstrip("/") + "/chat/completions",
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Index-Translate-Client/1.0",
                },
            )
            with urllib.request.urlopen(req, timeout=180) as resp:
                res = json.loads(resp.read().decode("utf-8"))
            return strip_think(res["choices"][0]["message"]["content"])
        except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
            last_err = e
            wait = 2 ** (attempt + 1)
            print("[chunk] attempt %d/%d failed (%s), retry in %ds" % (attempt + 1, retries, e, wait),
                  file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("translation failed after %d attempts: %s" % (retries, last_err))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="en", choices=sorted(LANG_NAMES))
    ap.add_argument("--preview", action="store_true",
                    help="translate only the first chunk and print it")
    ap.add_argument("--source", default=SOURCE)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    with open(args.source, encoding="utf-8") as f:
        text = f.read()
    chunks = split_chunks(text)
    print("source: %s (%d chars), %d chunks" % (args.source, len(text), len(chunks)), file=sys.stderr)

    if args.preview:
        print(translate_chunk(chunks[0], args.lang))
        return 0

    translated = []
    for i, chunk in enumerate(chunks, 1):
        print("[%d/%d] translating %d chars..." % (i, len(chunks), len(chunk)), file=sys.stderr)
        translated.append(translate_chunk(chunk, args.lang))
        time.sleep(1)  # be polite to the free endpoint

    out = args.out or os.path.join("translations", args.lang, "README.md")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    translated_text = rewrite_relative_links(
        "\n\n".join(translated).strip(),
        os.path.abspath(args.source),
        os.path.abspath(out),
    )
    translated_text = rewrite_language_switch(
        translated_text, args.lang, os.path.abspath(args.source), os.path.abspath(out)
    )
    with open(out, "w", encoding="utf-8") as f:
        f.write(translated_text + "\n")
    print("wrote " + out, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
