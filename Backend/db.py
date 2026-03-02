import os
import pyodbc
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")  # ensure Backend/.env is loaded

CONN_STR = os.getenv("SQLSERVER_CONN")
if not CONN_STR:
    raise RuntimeError("SQLSERVER_CONN missing. Put .env inside Backend/ or set env var.")


def get_connection():
    # autocommit False so inserts must be committed
    return pyodbc.connect(CONN_STR, autocommit=False)


def fetchall_dict(cursor):
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def fetchone_dict(cursor):
    row = cursor.fetchone()
    if not row:
        return None
    cols = [c[0] for c in cursor.description]
    return dict(zip(cols, row))