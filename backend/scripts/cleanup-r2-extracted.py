"""
One-shot script: elimina todos los objetos en {userId}/extracted/ del bucket R2.
Estos son backups redundantes — los datos viven en JSONB en la DB.

Uso: python3 cleanup-r2-extracted.py [--dry-run]
"""
import boto3, sys, os
from botocore.client import Config

DRY_RUN = '--dry-run' in sys.argv

# Credenciales R2 — leer del .env del proyecto
import subprocess, json
env_path = '/docker/onai-ocr/.env'
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

# Leer desde secrets.json si no están en .env
import json as json_mod
secrets = json_mod.load(open('/root/.openclaw/credentials/secrets.json'))
r2 = secrets['credentials']['cloudflare_r2']

ENDPOINT = f"https://{r2['account_id']}.r2.cloudflarestorage.com"
ACCESS_KEY = r2['access_key_id']
SECRET_KEY = r2['secret_access_key']
BUCKET = r2.get('bucket', 'onai-ocr-documents')

s3 = boto3.client(
    's3',
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    config=Config(signature_version='s3v4'),
    region_name='auto',
)

print(f"{'[DRY RUN] ' if DRY_RUN else ''}Buscando objetos en */extracted/ del bucket {BUCKET}...")

paginator = s3.get_paginator('list_objects_v2')
total = 0
deleted = 0

for page in paginator.paginate(Bucket=BUCKET):
    for obj in page.get('Contents', []):
        key = obj['Key']
        # Solo archivos en {cualquier_cosa}/extracted/
        parts = key.split('/')
        if len(parts) >= 2 and parts[1] == 'extracted':
            total += 1
            print(f"  {'[skip] ' if DRY_RUN else '[delete] '}{key} ({obj['Size']} bytes)")
            if not DRY_RUN:
                s3.delete_object(Bucket=BUCKET, Key=key)
                deleted += 1

print(f"\n{'[DRY RUN] ' if DRY_RUN else ''}Total encontrados: {total}, eliminados: {deleted if not DRY_RUN else 'N/A (dry run)'}")
