"""Генерация Pydantic-моделей из /schemas → app/schemas_gen. `--check` падает, если сгенерированное устарело."""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "app" / "schemas_gen"
HEADER = "# АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `make codegen`.\n"


def find_schemas() -> Path:
    for cand in (HERE.parent.parent / "schemas", Path("/srv/schemas")):
        if cand.exists():
            return cand
    sys.exit("Не найдена папка schemas")


def generate(src: Path, dst: Path) -> None:
    subprocess.run(
        [
            sys.executable, "-m", "datamodel_code_generator",
            "--input", str(src), "--input-file-type", "jsonschema", "--output", str(dst),
            "--output-model-type", "pydantic_v2.BaseModel", "--target-python-version", "3.12",
            "--use-standard-collections", "--use-union-operator", "--use-annotated", "--field-constraints",
            "--disable-timestamp", "--use-double-quotes", "--enum-field-as-literal", "all", "--use-schema-description",
            "--custom-file-header", HEADER, "--formatters", "builtin",
        ],
        check=True,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    schemas = find_schemas()
    files = sorted(schemas.glob("*.schema.json")) + sorted((schemas / "formats").glob("*.schema.json"))
    stale: list[str] = []
    with tempfile.TemporaryDirectory() as td:
        for f in files:
            name = f.name.removesuffix(".schema.json")
            tmp = Path(td) / f"{name}.py"
            generate(f, tmp)
            target = OUT / f"{name}.py"
            new = tmp.read_text(encoding="utf-8")
            if args.check:
                if not target.exists() or target.read_text(encoding="utf-8") != new:
                    stale.append(str(target))
            else:
                OUT.mkdir(parents=True, exist_ok=True)
                target.write_text(new, encoding="utf-8", newline="\n")
    init = OUT / "__init__.py"
    if not args.check and not init.exists():
        init.write_text(HEADER, encoding="utf-8", newline="\n")
    if stale:
        sys.exit("Pydantic-модели устарели, запусти `make codegen`:\n" + "\n".join(stale))
    print(f"codegen: {len(files)} схем {'актуальны' if args.check else 'сгенерированы'}")


if __name__ == "__main__":
    main()
