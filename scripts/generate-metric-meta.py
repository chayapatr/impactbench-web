#!/usr/bin/env python3
"""Generate per-metric metadata (contributor + "This matters because" sentence).

Reads every ``benchmark.yaml`` in the sibling ``impactbench-data`` repo and emits
``static/data/metric-meta.json``::

    {
      "<benchmark>__<metric_id>": {
        "contributor": "Flourishing AI Benchmark",
        "mattersBecause": "..."
      },
      ...
    }

The "matters because" sentence is produced by the Anthropic API using the metric
definition plus a short web-style context about the benchmark contributor. The
script is idempotent: existing entries are kept unless ``--force`` is passed.

Usage::

    ANTHROPIC_API_KEY=sk-ant-... python3 scripts/generate-metric-meta.py
    python3 scripts/generate-metric-meta.py --force          # regenerate everything
    python3 scripts/generate-metric-meta.py --only humanebench  # one benchmark
    python3 scripts/generate-metric-meta.py --dry-run         # no API calls

Environment variables:
    ANTHROPIC_API_KEY  required unless --dry-run
    ANTHROPIC_MODEL    default: claude-sonnet-4-5
    DATA_REPO          default: ../impactbench-data (relative to this script)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_REPO = (ROOT.parent / "impactbench-data").resolve()
OUTPUT_PATH = ROOT / "static" / "data" / "metric-meta.json"

SYSTEM_PROMPT = """You write a single short sentence explaining why an AI safety / wellbeing metric matters to everyday users. Use plain, concrete language. No hedging, no marketing fluff, no preamble."""

USER_TEMPLATE = """Benchmark: {benchmark_name}
Contributor (the org / project that authored this metric): {contributor}
Metric name: {metric_name}
Metric type: {metric_type}  (positive = behavior we want AI to do; negative = behavior we want AI to avoid)
Behavior measured: {definition}

Write exactly one short sentence (max ~28 words) starting with the words "This matters because" that explains the real-world stakes for the user.

Rules:
- For POSITIVE metrics, frame it around what users gain when AI does this well (e.g. "This matters because it is important for AI to encourage ... so that humans ...").
- For NEGATIVE metrics, frame it around what users avoid when AI restrains this behavior (e.g. "This matters because it is crucial that AI does not mislead ... which can lead to ...").
- Anchor the sentence in the specific behavior described above; don't be generic.
- Do not mention the benchmark name, the contributor, "this metric", or the word "AI" more than once.
- Return only the sentence — no quotes, no explanation."""


def slug_from_name(name: str) -> str:
    return (
        name.lower()
        .replace("&", "and")
        .replace("(", "")
        .replace(")", "")
        .replace("/", "-")
        .replace(",", "")
        .replace(":", "")
        .replace(".", "")
        .replace("'", "")
        .replace("\u2019", "")
        .replace(" ", "-")
    )


def discover_benchmarks(data_repo: Path) -> list[Path]:
    return sorted(p for p in data_repo.glob("*/benchmark.yaml") if p.is_file())


def load_existing(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        print(f"warning: {path} is not valid JSON, starting fresh", file=sys.stderr)
        return {}


def call_anthropic(client: Any, model: str, prompt: str, retries: int = 3) -> str:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=200,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            for block in resp.content:
                if getattr(block, "type", None) == "text":
                    return block.text.strip().strip('"').strip()
            raise RuntimeError("no text block in response")
        except Exception as exc:  # noqa: BLE001 - want to retry on anything transient
            last_err = exc
            wait = 2 ** attempt
            print(f"  retry {attempt + 1}/{retries} after {wait}s: {exc}", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"anthropic call failed after {retries} attempts: {last_err}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="regenerate even if entry already exists")
    parser.add_argument("--only", help="only process this benchmark folder name", default=None)
    parser.add_argument("--dry-run", action="store_true", help="skip API calls; just refresh contributor field")
    parser.add_argument("--data-repo", default=os.environ.get("DATA_REPO", str(DEFAULT_DATA_REPO)))
    parser.add_argument("--model", default=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"))
    args = parser.parse_args()

    data_repo = Path(args.data_repo).resolve()
    if not data_repo.exists():
        print(f"error: data repo not found at {data_repo}", file=sys.stderr)
        return 1

    benchmarks = discover_benchmarks(data_repo)
    if args.only:
        benchmarks = [b for b in benchmarks if b.parent.name == args.only]
        if not benchmarks:
            print(f"error: --only {args.only!r} matched no benchmark", file=sys.stderr)
            return 1

    client = None
    if not args.dry_run:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            print("error: ANTHROPIC_API_KEY not set (or pass --dry-run)", file=sys.stderr)
            return 1
        import anthropic  # local import so --dry-run works without the lib

        client = anthropic.Anthropic()

    existing = load_existing(OUTPUT_PATH)
    out: dict[str, dict[str, str]] = dict(existing)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    total = 0
    generated = 0
    for yaml_path in benchmarks:
        benchmark_slug = yaml_path.parent.name
        with yaml_path.open() as fh:
            doc = yaml.safe_load(fh)
        benchmark_name = doc.get("name", benchmark_slug)
        metrics = doc.get("metrics") or []
        for metric in metrics:
            mid = metric.get("id")
            if not mid:
                continue
            key = f"{benchmark_slug}__{mid}"
            total += 1
            contributor = metric.get("contributor") or benchmark_name
            existing_entry = out.get(key, {})
            needs_gen = args.force or not existing_entry.get("mattersBecause")

            if not needs_gen:
                # Keep prior mattersBecause; just refresh contributor in case it changed.
                existing_entry["contributor"] = contributor
                out[key] = existing_entry
                continue

            if args.dry_run or client is None:
                out[key] = {"contributor": contributor, "mattersBecause": existing_entry.get("mattersBecause", "")}
                continue

            prompt = USER_TEMPLATE.format(
                benchmark_name=benchmark_name,
                contributor=contributor,
                metric_name=metric.get("name", mid),
                metric_type=metric.get("type", "positive"),
                definition=(metric.get("definition") or "").strip(),
            )
            print(f"  generating {key}: {metric.get('name', mid)!r}")
            sentence = call_anthropic(client, args.model, prompt)
            out[key] = {"contributor": contributor, "mattersBecause": sentence}
            generated += 1
            # Persist after each call so a crash doesn't lose work.
            OUTPUT_PATH.write_text(
                json.dumps(out, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
            )

    OUTPUT_PATH.write_text(
        json.dumps(out, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    )
    print(f"done. {generated} generated, {total} total entries, wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
