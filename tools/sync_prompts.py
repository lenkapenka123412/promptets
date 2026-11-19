#!/usr/bin/env python3
"""Обновляет prompts.json и prompts-data.js из локальной CSV/JSON базы.
Использует только стандартную библиотеку Python.
Использование: python tools/sync_prompts.py prompts.csv
"""
import csv
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
COLUMNS = ["id", "phrase", "category", "level", "swear", "recommendation", "status", "favorite", "origin", "source_url", "editor_note"]


def read_records(filename):
    path = pathlib.Path(filename)
    if path.suffix.lower() == ".json":
        rows = json.loads(path.read_text(encoding="utf-8-sig"))
        if not isinstance(rows, list):
            raise ValueError("JSON должен содержать массив объектов")
    elif path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            sample = f.read(2048)
            f.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
                rows = list(csv.DictReader(f, dialect=dialect))
            except csv.Error:
                f.seek(0)
                rows = list(csv.DictReader(f, delimiter=","))
    else:
        raise ValueError("Поддерживаются только .csv и .json")
    result = []
    seen = set()
    for pos, r in enumerate(rows, 1):
        if not isinstance(r, dict):
            continue
        row = {k: str(r.get(k, "") or "").strip() for k in COLUMNS}
        if not row["phrase"]:
            continue
        if not row["id"]:
            row["id"] = f"P{pos:03d}"
        if row["id"] in seen:
            raise ValueError(f"Повторяющийся ID: {row['id']}")
        seen.add(row["id"])
        try:
            row["level"] = int(row["level"] or 2)
        except ValueError as error:
            raise ValueError(f"Неверный уровень у {row['id']}") from error
        if row["level"] not in (1, 2, 3):
            raise ValueError(f"Уровень у {row['id']} должен быть 1, 2 или 3")
        row["swear"] = "Да" if row["swear"].lower() in ("да", "yes", "true", "1") else "Нет"
        row["status"] = row["status"] or "На проверку"
        row["category"] = row["category"] or "Без категории"
        result.append(row)
    if not result:
        raise ValueError("Нет ни одной записи с заполненной колонкой phrase")
    return result


def main():
    source = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "prompts.csv"
    records = read_records(source)
    serialized = json.dumps(records, ensure_ascii=False, indent=2)
    # Безопасно размещаем JSON как строку в отдельном JS-файле без eval.
    (ROOT / "prompts.json").write_text(serialized + "\n", encoding="utf-8")
    (ROOT / "prompts-data.js").write_text("/* Автогенерация: tools/sync_prompts.py */\nwindow.PROMPTETS_DATA = " + serialized + ";\n", encoding="utf-8")
    with (ROOT / "prompts.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(records)
    active = sum(r["status"].lower() not in ("удалить", "отклонено", "deleted", "exclude") for r in records)
    print(f"Готово: {len(records)} записей, активных {active}. Обновлены prompts.csv, prompts.json, prompts-data.js")


if __name__ == "__main__":
    main()
