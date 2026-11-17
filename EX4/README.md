# Movies API – Week 4 (Express + PostgreSQL)

The Week 3 movie REST API, with the in-memory array replaced by a local PostgreSQL database.

## Run it

1. **Install PostgreSQL + pgAdmin 4** (EDB installer, which includes the command-line tools). Note your `postgres` password and port `5432`.
2. **Create the database.** In pgAdmin, right-click *Databases* → *Create* → *Database…* → name it `backend_course`.
3. **Create the table.** Right-click `backend_course` → *Query Tool*. Open `database.sql`, run it (F5), and you should see 3 movies.
4. **Configure.** Copy `.env.example` to `.env` and put your real password in `PGPASSWORD`.
5. **Install and start:**
   ```
   npm install
   npm start
   ```
6. Open `requests.http` in VS Code (REST Client extension) and send the requests from top to bottom.
   Run `database.sql` again first whenever you want the ids to start from a clean state.

## Endpoints

| Method | URL | Success | Errors |
|---|---|---|---|
| GET | /health/database | 200 | 503 |
| GET | /movies?director=&year=&sortBy=id\|year\|title&order=asc\|desc | 200 | 400 |
| GET | /movies/:id | 200 | 400, 404 |
| POST | /movies | 201 | 400 |
| PUT | /movies/:id | 200 | 400, 404 |
| PATCH | /movies/:id | 200 | 400, 404 |
| DELETE | /movies/:id | 204 | 400, 404 |

Body: `{ "title": string, "director": string, "year": integer }`
