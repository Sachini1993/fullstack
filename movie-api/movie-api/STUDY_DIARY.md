# Study Diary – Backend Development, Week 1

## Exercise 1: Backend Development Toolchain

### Versions
```
node --version   ->  v22.23.2     <-- 
npm --version    ->  10.9.8      <-- 
git --version    ->   2.51.1.windows.1  
```

**Screenshot:** *(insert a screenshot of VS Code with the movie-api project open, app.js in the editor, the server running in the integrated terminal and requests.http open with a response shown)*

### VS Code tools
- **What problem does REST Client solve?** It lets me write and send HTTP requests from a plain `.http` file inside VS Code, so I can test the API without leaving the editor, and the file doubles as saved, version-controlled API documentation.
- **ESLint vs Prettier?** ESLint analyses code for possible bugs and bad practices (unused variables, undefined names), while Prettier only formats the code (indentation, quotes, line breaks) so it looks consistent.
- **Most useful VS Code feature for backend work?** The integrated terminal, because I can run the server, see its logs and use npm/git right next to the code. The debugger (breakpoints in route handlers) is a close second.

### REST Client vs Postman
- **REST Client:** Lightweight, everything stays in the editor, and `requests.http` is a plain text file that can be committed to Git with the project.
- **Postman:** Graphical interface, easy to edit headers/body, keeps a history, supports collections, environments and automated tests – good for bigger APIs and teams.
- **Preference:** REST Client for this course, because it is faster to use while coding and the requests live in the repository. Postman is nice when I want to explore responses visually or share collections.

---

## Exercise 2: Movie REST API

### Implementation
The API is a single `app.js` using Express. Movies are stored in an in-memory array. `express.json()` parses JSON request bodies. Each route follows the flow **HTTP request → Express route → logic (find/validate/push) → HTTP response with status code + JSON**.

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | /movies | 200 | – |
| GET | /movies/:id | 200 | 404 |
| POST | /movies | 201 | 400 |
| PATCH | /movies/:id (bonus) | 200 | 404 |
| DELETE | /movies/:id (bonus) | 204 | 404 |

### Code snippets
```js
// GET /movies/:id
app.get("/movies/:id", (req, res) => {
  const id = Number(req.params.id);
  const movie = movies.find((m) => m.id === id);
  if (!movie) {
    return res.status(404).json({ error: "Movie not found" });
  }
  res.status(200).json(movie);
});
```

```js
// POST /movies
app.post("/movies", (req, res) => {
  const { title, director, year } = req.body || {};
  if (!title || !director || year === undefined) {
    return res.status(400).json({ error: "title, director and year are required" });
  }
  const newId = movies.length > 0 ? Math.max(...movies.map((m) => m.id)) + 1 : 1;
  const newMovie = { id: newId, title, director, year };
  movies.push(newMovie);
  res.status(201).json(newMovie);
});
```

### Evidence that the API works
See `test-output.txt` (full HTTP responses). Summary:

| Request | Expected | Actual |
|---|---|---|
| GET /movies | 200 OK | 200 OK – 3 movies |
| GET /movies/1 | 200 OK | 200 OK – Inception |
| GET /movies/999 | 404 Not Found | 404 `{"error":"Movie not found"}` |
| POST /movies (valid) | 201 Created | 201 `{"id":4,"title":"Blade Runner",...}` |
| POST /movies (missing data) | 400 Bad Request | 400 `{"error":"title, director and year are required"}` |
| PATCH /movies/1 `{year:2011}` | 200 OK | 200 – year is 2011 |
| DELETE /movies/1 | 204 No Content | 204 |
| GET /movies/1 after delete | 404 | 404 |

### What happened to the data after restarting?
After adding Blade Runner, GET /movies returned 4 movies. After stopping and restarting the server, only the original 3 movies were returned. The `movies` array lives in the Node.js process's memory (RAM); when the process stops that memory is released, and on restart the array is created again from the hard-coded starting data. To keep data permanently we need a database (or file), which comes later in the course.

### Problems and solutions
- `req.params.id` is a **string**, so `m.id === req.params.id` never matched. Fixed by converting with `Number(req.params.id)`.
- POST body was `undefined` when testing without the `Content-Type: application/json` header. Fixed by always sending the header (and `req.body || {}` so the server returns 400 instead of crashing).
- Generating IDs with `movies.length + 1` can create duplicates after a delete, so I used the highest existing id + 1.
- Validation: `year === undefined` is used instead of `!year` so that a numeric year is checked properly.

**GitHub repository:** *(add your link here)*

---

## Exercise 3: Testing with REST Client and Postman

The `requests.http` file contains all scenarios (GET all, GET by id, 404, POST valid, POST invalid, PATCH, DELETE, and verification GETs). A `@baseUrl` variable avoids repeating the address.

```http
@baseUrl = http://localhost:3000

### Get all movies
GET {{baseUrl}}/movies

### Movie that does not exist
GET {{baseUrl}}/movies/999

### Create a new movie
POST {{baseUrl}}/movies
Content-Type: application/json

{ "title": "Blade Runner", "director": "Ridley Scott", "year": 1982 }

### Invalid movie
POST {{baseUrl}}/movies
Content-Type: application/json

{ "director": "Nobody" }
```

**Evidence:** 200 / 201 / 404 / 400 responses are shown in the table above and in `test-output.txt`. *(Add screenshots of the REST Client response panel and of one GET + one POST in Postman.)*

**Postman vs REST Client – which do I prefer and why?** I prefer REST Client: I can test while coding without switching apps, and the requests file is saved in the repo as living documentation. Postman is more comfortable for inspecting responses and building larger shared collections, so I'd use it for bigger projects.

---

## Week 1 reflection
- **Node.js** runs JavaScript on the server, **npm** installs packages like Express, **Express** handles routing and HTTP responses, and **VS Code** is where I write, run and test the code.
- **Request → response flow:** a client sends an HTTP request (method + URL + optional body) → Express matches the route → the handler runs logic on the data → it sends back a status code and JSON.
- Status codes used: **200** OK, **201** Created, **204** No Content, **400** Bad Request, **404** Not Found.
- In-memory data disappears on restart because it only exists in the running process's RAM.
