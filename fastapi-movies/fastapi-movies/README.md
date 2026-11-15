# fastapi-movies

Week 3: the Express movies REST API ported to Python FastAPI.

## Setup

```bash
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

# Windows PowerShell
python -m venv .venv
.venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs

## Endpoints

| Method | Path | Description | Success | Errors |
|---|---|---|---|---|
| GET | `/movies` | List movies, optional `?min_year=` and `?director=` | 200 | 422 bad query value |
| GET | `/movies/{movie_id}` | Get one movie | 200 | 404, 422 |
| POST | `/movies` | Create a movie (server generates id) | 201 | 422 |
| PUT | `/movies/{movie_id}` | Replace a movie (all fields required, id kept) | 200 | 404, 422 |
| PATCH | `/movies/{movie_id}` | Update only the fields sent | 200 | 404, 422 |
| DELETE | `/movies/{movie_id}` | Delete a movie | 204 | 404 |

## Automated checks

```bash
python test_api.py
```

Runs every test from the Task 5 table (plus a few extra error cases) and prints the status code and response for each.

Data is stored in memory, so it resets every time the server restarts.
