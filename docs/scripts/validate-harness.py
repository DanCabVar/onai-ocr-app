#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

required = [
    'AGENTS.md', 'PLAN_MAESTRO.md', '03_specs/active', '03_specs/done',
    '06_history/SPEC_HISTORY.md', '06_history/DECISIONS.md', '06_history/INCIDENTS.md',
    '07_runbooks', 'templates/SPEC.template.md', 'templates/DECISION.template.md',
    'templates/INCIDENT.template.md', 'templates/RUNBOOK.template.md'
]
for rel in required:
    if not (ROOT / rel).exists():
        errors.append(f'Missing required path: {rel}')

plan = (ROOT / 'PLAN_MAESTRO.md').read_text(encoding='utf-8') if (ROOT / 'PLAN_MAESTRO.md').exists() else ''
history = (ROOT / '06_history/SPEC_HISTORY.md').read_text(encoding='utf-8') if (ROOT / '06_history/SPEC_HISTORY.md').exists() else ''
decisions = (ROOT / '06_history/DECISIONS.md').read_text(encoding='utf-8') if (ROOT / '06_history/DECISIONS.md').exists() else ''

# Plan spec paths must exist.
for m in re.finditer(r'`([^`]*SPEC-[^`]+\.md)`', plan):
    rel = m.group(1)
    if not (ROOT / rel).exists():
        errors.append(f'PLAN_MAESTRO references missing spec: {rel}')

# Every active spec except README and SPEC-00 should be referenced in PLAN_MAESTRO or SPEC_HISTORY.
for spec in sorted((ROOT / '03_specs/active').glob('SPEC-*.md')):
    rel = spec.relative_to(ROOT).as_posix()
    if spec.name.startswith('SPEC-00'):
        continue
    if rel not in plan and rel not in history:
        errors.append(f'Active spec not referenced in plan/history: {rel}')

# Every ADR indexed must exist.
for m in re.finditer(r'`(decisions/ADR-[^`]+\.md)`', decisions):
    rel = '06_history/' + m.group(1)
    if not (ROOT / rel).exists():
        errors.append(f'DECISIONS references missing ADR: {rel}')

# Template structural lint.
template_sections = {
    'templates/SPEC.template.md': ['## Objetivo', '## Contexto', '## Criterios de aceptación', '## Plan de prueba / verificación mínima', '## Riesgos y rollback'],
    'templates/DECISION.template.md': ['## Context', '## Options evaluated', '## Decision', '## Consequences', '## Reversibility'],
    'templates/INCIDENT.template.md': ['## Resumen', '## Timeline', '## Causa raíz', '## Mitigación', '## Seguimiento'],
    'templates/RUNBOOK.template.md': ['## Cuándo usarlo', '## Procedimiento', '## Verificación', '## Rollback'],
}
for rel, sections in template_sections.items():
    p = ROOT / rel
    if not p.exists():
        continue
    txt = p.read_text(encoding='utf-8')
    for section in sections:
        if section not in txt:
            errors.append(f'{rel} missing section: {section}')

if errors:
    print('Harness validation FAILED:')
    for e in errors:
        print(f'- {e}')
    sys.exit(1)
print('Harness validation OK')
