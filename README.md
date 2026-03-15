# Pet App CareSpace

## Clean structure

- `Backend/`
  Flask API and SQL Server backend
- `web/`
  New React web app integrated with the backend
- `legacy/`
  Older Flutter frontends preserved for reference only
- `web.zip`
  Zipped copy of the React web app

## Run locally

### Backend

1. Open `Backend/`
2. Install Python dependencies:
   `pip install -r requirements.txt`
3. Apply `schema.sql` to your SQL Server database
4. Start Flask:
   `python app.py`

### Web

1. Open `web/`
2. Install Node dependencies:
   `npm.cmd install`
3. Start Vite:
   `npm.cmd run dev`

If needed, set `VITE_API_BASE_URL` in `web/.env`.
