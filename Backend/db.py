import os
from datetime import date, datetime
from decimal import Decimal
import pyodbc
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")  # ensure Backend/.env is loaded

CONN_STR = os.getenv("SQLSERVER_CONN")
if not CONN_STR:
    raise RuntimeError("SQLSERVER_CONN missing. Put .env inside Backend/ or set env var.")


def get_connection():
    # override server to 127.0.0.1,1433
    conn_str = CONN_STR.replace("Server=localhost", "Server=127.0.0.1,1433")
    return pyodbc.connect(conn_str, autocommit=False)


def ensure_schema():
    schema_path = BASE_DIR / "schema.sql"
    if not schema_path.exists():
        return

    with schema_path.open("r", encoding="utf-8") as handle:
        raw = handle.read()

    blocks = []
    buffer = []
    for line in raw.splitlines():
        if line.strip().startswith("--"):
            continue
        if not line.strip():
            if buffer:
                blocks.append("\n".join(buffer).strip())
                buffer = []
            continue
        buffer.append(line)
    if buffer:
        blocks.append("\n".join(buffer).strip())

    if not blocks:
        return

    conn = get_connection()
    try:
        cur = conn.cursor()
        for block in blocks:
            if block:
                cur.execute(block)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _normalize_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def fetchall_dict(cursor):
    cols = [c[0] for c in cursor.description]
    rows = []
    for row in cursor.fetchall():
        rows.append({col: _normalize_value(val) for col, val in zip(cols, row)})
    return rows


def fetchone_dict(cursor):
    row = cursor.fetchone()
    if not row:
        return None
    cols = [c[0] for c in cursor.description]
    return {col: _normalize_value(val) for col, val in zip(cols, row)}
