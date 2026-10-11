"""Shared strict selection for source and semantic command entry points."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def selection():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--building', default='B03')
    parser.add_argument('--floor', default='GF')
    parser.add_argument('--regenerate', action='store_true')
    parser.add_argument('--metadata-only', action='store_true')
    args = parser.parse_args()
    if args.building != 'B03' or args.floor not in ('GF', '01'):
        parser.error(f'Unsupported source/semantic selection: {args.building}/{args.floor}')
    return args


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding='utf8'))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')
