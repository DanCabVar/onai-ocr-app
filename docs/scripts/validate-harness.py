#!/usr/bin/env python3
from pathlib import Path
import re
import sys

DOCS = Path(__file__).resolve().parents[1]
REPO = DOCS.parent
errors = []

required_repo = ['AGENTS.md']
required_docs = [
    'PLAN_MAESTRO.md', '03_specs/active', '03_specs/done',
    '06_history/SPEC_HISTORY.md', '06_history/DECISIONS.md', '06_history/INCIDENTS.md',
    '07_runbooks', 'templates/SPEC.template.md', 'templates/DECISION.template.md',
    'templates/INCIDENT.template.md', 'templates/RUNBOOK.template.md'
]
for rel in required_repo:
    if not (REPO / rel).exists():
        errors.append(f'Missing required repo path: {rel}')
for rel in required_docs:
    if not (DOCS / rel).exists():
        errors.append(f'Missing required docs path: docs/{rel}')

plan = (DOCS / 'PLAN_MAESTRO.md').read_text(encoding='utf-8') if (DOCS / 'PLAN_MAESTRO.md').exists() else ''
history = (DOCS / '06_history/SPEC_HISTORY.md').read_text(encoding='utf-8') if (DOCS / '06_history/SPEC_HISTORY.md').exists() else ''
decisions = (DOCS / '06_history/DECISIONS.md').read_text(encoding='utf-8') if (DOCS / '06_history/DECISIONS.md').exists() else ''

# Plan spec paths must exist. Accept both docs-prefixed and docs-relative paths.
for m in re.finditer(r'`([^`]*SPEC-[^`]+\.md)`', plan):
    rel = m.group(1)
    p = REPO / rel if rel.startswith('docs/') else DOCS / rel
    if not p.exists():
        errors.append(f'PLAN_MAESTRO references missing spec: {rel}')

# Every active spec except README and SPEC-00 should be referenced in PLAN_MAESTRO or SPEC_HISTORY.
for spec in sorted((DOCS / '03_specs/active').glob('SPEC-*.md')):
    rel_docs = 'docs/' + spec.relative_to(DOCS).as_posix()
    rel_local = spec.relative_to(DOCS).as_posix()
    if spec.name.startswith('SPEC-00'):
        continue
    if rel_docs not in plan and rel_local not in plan and rel_docs not in history and rel_local not in history:
        errors.append(f'Active spec not referenced in plan/history: {rel_docs}')

# Every ADR indexed must exist.
for m in re.finditer(r'`(decisions/ADR-[^`]+\.md)`', decisions):
    rel = '06_history/' + m.group(1)
    if not (DOCS / rel).exists():
        errors.append(f'DECISIONS references missing ADR: docs/{rel}')

# Template structural lint.
template_sections = {
    'templates/SPEC.template.md': ['## Objetivo', '## Contexto', '## Criterios de aceptación', '## Plan de prueba / verificación mínima', '## Riesgos y rollback'],
    'templates/DECISION.template.md': ['## Context', '## Options evaluated', '## Decision', '## Consequences', '## Reversibility'],
    'templates/INCIDENT.template.md': ['## Resumen', '## Timeline', '## Causa raíz', '## Mitigación', '## Seguimiento'],
    'templates/RUNBOOK.template.md': ['## Cuándo usarlo', '## Procedimiento', '## Verificación', '## Rollback'],
}
for rel, sections in template_sections.items():
    p = DOCS / rel
    if not p.exists():
        continue
    txt = p.read_text(encoding='utf-8')
    for section in sections:
        if section not in txt:
            errors.append(f'docs/{rel} missing section: {section}')

if errors:
    print('Harness validation FAILED:')
    for e in errors:
        print(f'- {e}')
    sys.exit(1)
print('Harness validation OK')
