#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


SPEC_DIR = Path("docs/03_specs/active")
QA_REPORTS_DIR = Path("docs/05_entregables/qa_reports")
SPEC_PATH_RE = re.compile(r"^docs/03_specs/active/SPEC-\d+.*\.md$")
TEST_FILE_RE = re.compile(
    r"(^|/)(__tests__|tests?|e2e)(/|$)|(\.|_)(test|spec)\.(ts|tsx|js|jsx|py)$",
    re.IGNORECASE,
)
HEADING_RE = re.compile(r"^##\s+", re.MULTILINE)
TEST_PLAN_HEADING_RE = re.compile(
    r"^##\s+Plan de prueba / verificaci[oó]n m[ií]nima\s*$",
    re.IGNORECASE | re.MULTILINE,
)
EXCEPTION_RE = re.compile(
    r"^\s*-\s*Excepci[oó]n de test automatizado:\s*(S[ií]|No)\s*$",
    re.IGNORECASE | re.MULTILINE,
)
EXCEPTION_REASON_RE = re.compile(
    r"^\s*-\s*Motivo de excepci[oó]n:\s*(.+?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate mandatory test policy for changed active specs."
    )
    parser.add_argument(
        "changed_files",
        nargs="*",
        help="Repo-relative changed files (typically from git diff --name-only).",
    )
    return parser.parse_args()


def extract_test_plan_section(text: str) -> str | None:
    match = TEST_PLAN_HEADING_RE.search(text)
    if not match:
        return None
    start = match.end()
    tail = text[start:]
    next_heading = HEADING_RE.search(tail)
    end = start + next_heading.start() if next_heading else len(text)
    return text[start:end].strip()


def has_required_test_cases(test_plan: str) -> bool:
    lowered = test_plan.lower()
    return "positivo" in lowered and "negativo" in lowered and "borde" in lowered


def has_automated_test_evidence(changed_files: list[str]) -> bool:
    for path in changed_files:
        if TEST_FILE_RE.search(path):
            return True
        if path.startswith(QA_REPORTS_DIR.as_posix() + "/"):
            return True
    return False


def main() -> int:
    args = parse_args()
    changed_files = [p.strip().replace("\\", "/") for p in args.changed_files if p.strip()]
    changed_specs = [p for p in changed_files if SPEC_PATH_RE.match(p)]

    if not changed_specs:
        print("SPEC test policy: no changed active specs; validation skipped.")
        return 0

    failures: list[str] = []
    exception_count = 0

    for spec_path in changed_specs:
        spec_file = Path(spec_path)
        if not spec_file.exists():
            failures.append(f"{spec_path}: file does not exist in workspace.")
            continue

        content = spec_file.read_text(encoding="utf-8")
        test_plan = extract_test_plan_section(content)
        if not test_plan:
            failures.append(
                f"{spec_path}: missing section '## Plan de prueba / verificacion minima'."
            )
            continue
        if not has_required_test_cases(test_plan):
            failures.append(
                f"{spec_path}: test plan must include cases positivo, negativo y borde."
            )

        exception_match = EXCEPTION_RE.search(test_plan)
        if exception_match and exception_match.group(1).lower().startswith("si"):
            reason_match = EXCEPTION_REASON_RE.search(test_plan)
            if not reason_match or reason_match.group(1).strip() in {"", "N/A", "n/a", "pendiente"}:
                failures.append(
                    f"{spec_path}: test exception marked as Si, but no concrete exception reason was provided."
                )
            exception_count += 1

    if failures:
        print("SPEC test policy FAILED:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    all_changed_specs_have_exception = exception_count == len(changed_specs)
    if not all_changed_specs_have_exception and not has_automated_test_evidence(changed_files):
        print("SPEC test policy FAILED:")
        print(
            "- Changed active spec(s) require automated-test evidence: add at least one changed "
            "test file or a QA report under docs/05_entregables/qa_reports/."
        )
        return 1

    print("SPEC test policy OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
