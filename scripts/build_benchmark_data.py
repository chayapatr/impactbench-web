#!/usr/bin/env python3
"""
Build benchmark-data.json, models.json, and scenario-index.json for the web app,
reading from the bench-py pipeline (../bench-py/benchmarks/<bench>/...).

Key format:  "modelId|age"   (age: "child" | "adult")
Score:  results.json's by_metric.<mid>.pass_rate (already oriented so 1 = good;
        see lib/core/evaluate.py in bench-py — inversion for negative metrics is
        baked in there, not needed here).

Metric IDs match the taxonomy: "<benchmark_slug>__<mid>"

Reads (per benchmark folder under bench-py/benchmarks/):
  - scenarios.json                    (metric_id, demographic.age per scenario)
  - results.json                      (per-model aggregate pass rates by metric)
  - runs/<model>/scores.json          (per-scenario pass/fail, for scenario-index + age split)
  - impactbench/static/data/taxonomy.json   (source of truth for valid metric IDs)

Writes:
  - static/data/benchmark-data.json
  - static/data/models.json
  - static/data/scenario-index.json
"""

import json
import os
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
IMPACTBENCH_DIR = SCRIPT_DIR.parent
DATA_DIR = IMPACTBENCH_DIR / "static" / "data"
BENCH_PY_DIR = IMPACTBENCH_DIR.parent / "bench-py"
BENCHMARKS_DIR = BENCH_PY_DIR / "benchmarks"

# Benchmark folders to skip (test/duplicate scaffolding, not in taxonomy).
SKIP_BENCHMARKS = {"e2e-test", "mcab"}

# ── Model ID mapping: bench-py run dir name -> clean web model ID ────────────
MODEL_MAP = {
    "DeepSeek-V3.2": "deepseek-v3",
    "Llama-4-Maverick": "llama-4",
    "Mistral-Small-3.2": "mistral-small-3",
    "Qwen3-Next-80B": "qwen3-80b",
    "claude-haiku-4-5": "claude-haiku-4-5",
    "claude-opus-4-6": "claude-opus-4-6",
    "claude-sonnet-4-6": "claude-sonnet-4-6",
    "gemini-2.5-pro": "gemini-2-5-pro",
    "gemma-4-31B-it": "gemma-4-31b",
    "gpt-4o": "gpt-4o",
    "gpt-5-chat-latest": "gpt-5",
    "gpt-5.1": "gpt-5-1",
    "grok-4-1-fast-non-reasoning": "grok-4-1",
    "grok-4-1-fast-reasoning": "grok-4-1-reasoning",
    "apertus-8b": "apertus-8b",
}

MODEL_METADATA = {
    "deepseek-v3": {"name": "DeepSeek V3.2", "provider": "DeepSeek", "releaseYear": 2025},
    "llama-4": {"name": "Llama 4 Maverick", "provider": "Meta", "releaseYear": 2025},
    "mistral-small-3": {"name": "Mistral Small 3.2", "provider": "Mistral", "releaseYear": 2025},
    "qwen3-80b": {"name": "Qwen3 80B", "provider": "Alibaba", "releaseYear": 2025},
    "claude-haiku-4-5": {"name": "Claude Haiku 4.5", "provider": "Anthropic", "releaseYear": 2025},
    "claude-opus-4-6": {"name": "Claude Opus 4.6", "provider": "Anthropic", "releaseYear": 2025},
    "claude-sonnet-4-6": {"name": "Claude Sonnet 4.6", "provider": "Anthropic", "releaseYear": 2025},
    "gemini-2-5-pro": {"name": "Gemini 2.5 Pro", "provider": "Google", "releaseYear": 2025},
    "gemma-4-31b": {"name": "Gemma 4 31B", "provider": "Google", "releaseYear": 2025},
    "gpt-4o": {"name": "GPT-4o", "provider": "OpenAI", "releaseYear": 2024},
    "gpt-5": {"name": "GPT-5", "provider": "OpenAI", "releaseYear": 2025},
    "gpt-5-1": {"name": "GPT-5.1", "provider": "OpenAI", "releaseYear": 2025},
    "grok-4-1": {"name": "Grok 4.1", "provider": "xAI", "releaseYear": 2025},
    "grok-4-1-reasoning": {"name": "Grok 4.1 (Reasoning)", "provider": "xAI", "releaseYear": 2025},
    "apertus-8b": {"name": "Apertus 8B", "provider": "Swiss AI", "releaseYear": 2025},
}


def load_taxonomy_valid_ids() -> set[str]:
    tax_path = DATA_DIR / "taxonomy.json"
    with open(tax_path) as f:
        tax = json.load(f)
    valid_ids = set()
    for area in tax["areas"]:
        for sub in area.get("subareas", []):
            for m in sub.get("metrics", []):
                valid_ids.add(m["id"])
    return valid_ids


def discover_benchmarks() -> list[str]:
    return sorted(
        p.name
        for p in BENCHMARKS_DIR.iterdir()
        if p.is_dir()
        and p.name not in SKIP_BENCHMARKS
        and (p / "benchmark.yaml").exists()
    )


def load_scenario_ages(bench_dir: Path) -> dict[str, str]:
    """scenario id -> 'child' | 'adult'"""
    scenarios_path = bench_dir / "scenarios.json"
    if not scenarios_path.exists():
        return {}
    with open(scenarios_path) as f:
        scenarios = json.load(f)
    ages = {}
    for s in scenarios:
        age_str = s.get("demographic", {}).get("age", "")
        ages[s["id"]] = "child" if "6-17" in age_str or "child" in age_str.lower() else "adult"
    return ages


def compute_benchmark_data(valid_ids: set[str], benchmarks: list[str]) -> dict:
    # web_model -> age -> metric_key -> {yes, tot}
    acc: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"yes": 0, "tot": 0})))

    for bench_name in benchmarks:
        bench_dir = BENCHMARKS_DIR / bench_name
        runs_dir = bench_dir / "runs"
        if not runs_dir.is_dir():
            continue

        ages = load_scenario_ages(bench_dir)

        for raw_model in sorted(os.listdir(runs_dir)):
            web_model = MODEL_MAP.get(raw_model)
            if web_model is None:
                print(f"  [skip] unmapped model: {raw_model}")
                continue

            scores_path = runs_dir / raw_model / "scores.json"
            if not scores_path.exists():
                continue
            with open(scores_path) as f:
                rows = json.load(f)

            for row in rows:
                sid = row.get("id", "")
                mid = row.get("metric_id", "")
                passed = row.get("passed")
                if passed is None:
                    continue

                metric_key = f"{bench_name}__{mid}"
                if metric_key not in valid_ids:
                    continue

                age = ages.get(sid, "adult")
                bucket = acc[web_model][age][metric_key]
                bucket["yes"] += 1 if passed else 0
                bucket["tot"] += 1

    output: dict = {}
    for web_model in sorted(acc):
        for age in ["child", "adult"]:
            if age not in acc[web_model]:
                continue
            key = f"{web_model}|{age}"
            scores: dict[str, float] = {}
            for metric_key, bucket in acc[web_model][age].items():
                if bucket["tot"] == 0:
                    continue
                scores[metric_key] = round(bucket["yes"] / bucket["tot"], 4)
            if scores:
                output[key] = scores

    return output


def build_models_json(used_ids: set[str]) -> dict:
    models = []
    for mid in sorted(used_ids):
        meta = MODEL_METADATA.get(mid, {})
        models.append({
            "id": mid,
            "name": meta.get("name", mid),
            "provider": meta.get("provider", "Unknown"),
            "version": mid,
            "releaseYear": meta.get("releaseYear", 2025),
        })
    return {"models": models}


def build_scenario_index(valid_ids: set[str], benchmarks: list[str]) -> dict:
    index: dict[str, list] = defaultdict(list)

    for bench_name in benchmarks:
        bench_dir = BENCHMARKS_DIR / bench_name
        scenarios_path = bench_dir / "scenarios.json"
        runs_dir = bench_dir / "runs"
        if not scenarios_path.exists() or not runs_dir.is_dir():
            continue

        with open(scenarios_path) as f:
            scenarios = json.load(f)
        scenario_by_id = {s["id"]: s for s in scenarios}
        ages = load_scenario_ages(bench_dir)

        # verdicts[(scenario_id, metric_id)][web_model] = "yes" | "no"
        verdicts: dict[tuple, dict[str, str]] = defaultdict(dict)
        for raw_model in sorted(os.listdir(runs_dir)):
            web_model = MODEL_MAP.get(raw_model)
            if web_model is None:
                continue
            scores_path = runs_dir / raw_model / "scores.json"
            if not scores_path.exists():
                continue
            with open(scores_path) as f:
                rows = json.load(f)
            for row in rows:
                present = row.get("present")
                if present is None:
                    continue
                key = (row["id"], row["metric_id"])
                verdicts[key][web_model] = "yes" if present else "no"

        for sid, scenario in scenario_by_id.items():
            mid = scenario["metric_id"]
            metric_key = f"{bench_name}__{mid}"
            if metric_key not in valid_ids:
                continue

            index[metric_key].append({
                "scenario_id": sid,
                "title": scenario.get("user_goal", sid),
                "age": ages.get(sid, "adult"),
                "benchmark": bench_name,
                "verdicts": verdicts.get((sid, mid), {}),
            })

    return dict(index)


def main():
    print("Loading taxonomy from impactbench (source of truth)...")
    valid_ids = load_taxonomy_valid_ids()
    print(f"  {len(valid_ids)} valid metric IDs")

    benchmarks = discover_benchmarks()
    print(f"Discovered {len(benchmarks)} benchmarks in bench-py")

    print("Computing benchmark data...")
    benchmark_data = compute_benchmark_data(valid_ids, benchmarks)
    used_ids = set(k.split("|")[0] for k in benchmark_data)
    print(f"  {len(benchmark_data)} keys ({len(used_ids)} models x ages)")

    print("Building scenario index...")
    scenario_index = build_scenario_index(valid_ids, benchmarks)
    total_scenarios = sum(len(v) for v in scenario_index.values())
    print(f"  {len(scenario_index)} metrics, {total_scenarios} scenario entries")

    print("Writing outputs...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    bd_path = DATA_DIR / "benchmark-data.json"
    with open(bd_path, "w") as f:
        json.dump(benchmark_data, f, separators=(",", ":"))
    print(f"  {bd_path}  ({bd_path.stat().st_size // 1024} KB)")

    ml_path = DATA_DIR / "models.json"
    with open(ml_path, "w") as f:
        json.dump(build_models_json(used_ids), f, indent=2)
    print(f"  {ml_path}")

    si_path = DATA_DIR / "scenario-index.json"
    with open(si_path, "w") as f:
        json.dump(scenario_index, f, separators=(",", ":"))
    print(f"  {si_path}  ({si_path.stat().st_size // 1024} KB)")

    print("Done.")


if __name__ == "__main__":
    main()
