# Study Diary – Backend Development, Week 2
## Building a Better REST API (Movie API)

**Tech:** Node.js 22, Express 5.3, Morgan · Data stored in an in-memory JavaScript array (no database)
**Files:** `app.js` (server), `requests.http` (repeatable tests), `test-output-week2.txt` (recorded responses + Morgan log), `package.json`

**Repository:** https://github.com/Sachini1993/fullstack (folder `movie-api/movie-api`)

---

## 1. Implementation

### 1.1 Endpoints

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/movies` | 200 + array | 400 invalid query parameter |
| GET | `/movies/:id` | 200 + movie | 404 `MOVIE_NOT_FOUND` |
| POST | `/movies` | 201 + created movie (server creates `id`) | 400 `VALIDATION_ERROR` |
| PUT | `/movies/:id` | 200 + replaced movie | 400, 404 |
| PATCH | `/movies/:id` | 200 + updated movie | 400, 404 |
| DELETE | `/movies/:id` | 204, empty body | 404 |
| any | unknown route | – | 404 `ROUTE_NOT_FOUND` |

The Week 1 endpoints (GET all, GET one, POST) were re-checked and still behave correctly (tests 1–4 below). New ids come from a `nextId` counter, so an id is never reused even after a delete.

**Changes from Week 1:** In Week 1 a movie had `title`, `director` and `year`, PATCH and DELETE were bonus endpoints, and errors were plain strings like `{ "error": "Movie not found" }`. This week I changed the movie model to `title`, `year` and `genre` as required by the brief, added PUT, replaced the simple `!title` checks with the `validateMovie()` function, switched to the structured error format, and made PATCH validate its input (in Week 1 PATCH accepted any value).

### 1.2 PUT vs PATCH in my code

```js
// PUT – full replacement, all fields required, id preserved
app.put("/movies/:id", (req, res) => {
  const index = findMovieIndex(req.params.id);
  if (index === -1) return sendNotFound(res);

  const errors = validateMovie(req.body || {}, false);   // partial = false
  if (errors.length > 0) return sendValidationError(res, errors);

  const replaced = {
    id: movies[index].id,
    title: req.body.title.trim(),
    year: req.body.year,
    genre: req.body.genre.trim()
  };
  movies[index] = replaced;
  res.status(200).json(replaced);
});

// PATCH – only provided fields change
app.patch("/movies/:id", (req, res) => {
  const index = findMovieIndex(req.params.id);
  if (index === -1) return sendNotFound(res);

  const body = req.body || {};
  const errors = validateMovie(body, true);              // partial = true
  if (errors.length > 0) return sendValidationError(res, errors);

  const movie = movies[index];
  if (body.title !== undefined) movie.title = body.title.trim();
  if (body.year  !== undefined) movie.year  = body.year;
  if (body.genre !== undefined) movie.genre = body.genre.trim();
  res.status(200).json(movie);
});
```

PUT builds a brand-new object from the request body (keeping only the old `id`), so every field must be present. PATCH modifies the existing object and only touches properties that are **not `undefined`**. I check `!== undefined` instead of a truthy check because a truthy check would silently ignore valid falsy values (for example `0` or `""`) instead of letting validation reject or accept them.

```js
// DELETE
app.delete("/movies/:id", (req, res) => {
  const index = findMovieIndex(req.params.id);
  if (index === -1) return sendNotFound(res);
  movies.splice(index, 1);
  res.status(204).end();   // 204 must not have a body
});
```

### 1.3 Task 1.5 – PUT and PATCH questions

- **Replacing vs partially updating:** PUT replaces the whole resource with the representation sent by the client. PATCH changes only the fields that are sent and keeps everything else.
- **Why PUT requires all properties:** Because the request body *becomes* the new movie. If a field were missing, the replaced movie would be incomplete, so the API rejects it.
- **Why PATCH is convenient:** To change only the year, the client sends `{ "year": 2011 }` and does not need to fetch and resend the title and genre.
- **`genre` missing from PUT:** `400 Bad Request` with `"genre is required"` in `details`; the movie is not changed.
- **`genre` missing from PATCH:** No problem – the genre stays as it was and the other provided fields are updated (200 OK).

### 1.4 Validation rules (Task 2)

| Property | Rule | Error message |
|---|---|---|
| title | non-empty string (after trim) | `title is required` / `title must be a non-empty string` |
| year | integer, 1888 … current year + 5 | `year is required` / `year must be a valid integer` |
| genre | non-empty string (after trim) | `genre is required` / `genre must be a non-empty string` |

`validateMovie(body, partial)` returns an array of error messages. POST and PUT use `partial = false` (all fields required); PATCH uses `partial = true` (only provided fields are checked). All errors are collected, so the client sees every problem in one response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Movie data is invalid",
    "details": ["title must be a non-empty string", "year must be a valid integer", "genre is required"]
  }
}
```

Every error uses the same shape `{ error: { code, message, details? } }`: `VALIDATION_ERROR`, `MOVIE_NOT_FOUND`, `INVALID_QUERY_PARAMETER`, `ROUTE_NOT_FOUND`, `INVALID_JSON`, `INTERNAL_SERVER_ERROR`.

### 1.5 Query parameters (Task 3)

| Parameter | Behaviour | Invalid value |
|---|---|---|
| `genre` | Case-insensitive exact match (`sci-fi` = `Sci-Fi`) | – |
| `minYear` | Movies with `year >= minYear` | 400 if not an integer |
| `sort` | `year` = oldest → newest, `title` = alphabetical | 400 if not `year`/`title` |

All parameters are optional and can be combined. No match returns `200 []`.

```js
let result = [...movies];   // copy -> the original array order is never changed
if (genre !== undefined)
  result = result.filter(m => m.genre.toLowerCase() === genre.toLowerCase());
if (minYearNumber !== undefined)
  result = result.filter(m => m.year >= minYearNumber);
if (sort === "year")  result.sort((a, b) => a.year - b.year);
if (sort === "title") result.sort((a, b) => a.title.localeCompare(b.title));
```

`Array.prototype.sort()` sorts in place, so sorting `movies` directly would permanently change the stored order. Test 20 confirms the original order is kept after `?sort=title`.

---

## 2. Middleware (Task 4)

### Middleware order in `app.js`

```js
app.use(express.json());   // 1. parse JSON bodies
app.use(morgan("dev"));    // 2. log requests
// 3. routes: GET, POST, PUT, PATCH, DELETE ...
app.use(unknownRouteHandler);  // 4. 404 fallback
app.use(errorHandler);         // 5. (err, req, res, next) – last
```

### What does `express.json()` do?
It reads the request body, and if `Content-Type` is `application/json`, parses the JSON string into a JavaScript object and puts it in `req.body`. **Without it, `req.body` is `undefined`.** I tested this by commenting it out: the server printed `req.body = undefined`, a valid POST was rejected with `title is required, year is required, genre is required`, and a PATCH silently changed nothing. In Express 5, accessing `req.body.title` without a fallback would even crash with a TypeError, which is why I use `req.body || {}`.

I also handle malformed JSON in the error handler (`err.type === "entity.parse.failed"` → 400 `INVALID_JSON`), because that is the client's fault, not a 500.

### Simple logger and `next()` (Task 4.2)

```js
function simpleLogger(req, res, next) {
  console.log(req.method, req.originalUrl);
  next();
}
```

Terminal output from my test:

```
GET /movies
GET /movies/1
POST /movies
PATCH /movies/1
```

- **When is it executed?** For every incoming request, before the route handlers, because it is registered with `app.use()` above the routes. Middleware runs in the order it was registered.
- **What does `next()` do?** It passes control to the next middleware or route handler in the pipeline.
- **If `next()` is removed and no response is sent?** The request gets stuck: no route handler runs, the client keeps waiting until it times out.

### Own logger vs Morgan

| | Simple logger | Morgan (`dev`) |
|---|---|---|
| Logs | method + URL | method, URL, status code (coloured), response time, response size |
| When it logs | when the request *arrives* | when the response *finishes*, so it knows the status |
| Effort | written by me, 4 lines | third-party package, configurable formats |

After testing I disabled my own logger (`// app.use(simpleLogger);`) so requests are not logged twice. The lesson: middleware can be written by me, built into Express (`express.json()`), or installed from npm (Morgan).

### Why middleware order matters
- `express.json()` must be before the routes, otherwise `req.body` is empty when the routes run.
- The 404 fallback must be after all routes – if it were first, it would answer *every* request with 404.
- The error handler (4 parameters) must be last so it can catch errors from everything above it.

---

## 3. Testing (Task 5)

All tests are in `requests.http` (VS Code REST Client) and can be repeated by restarting the server (data resets because it is in memory). Tests were run in order against a fresh server; the full raw responses are saved in `test-output-week2.txt` in the repository.

| # | Test | Expected | Actual |
|---|---|---|---|
| 1 | GET all movies | 200, array | ✅ 200, array of 5 |
| 2 | GET /movies/1 | 200, correct movie | ✅ 200, Inception |
| 3 | GET /movies/999 | 404 | ✅ 404 `MOVIE_NOT_FOUND` |
| 4 | POST valid | 201, id created | ✅ 201, id 6 |
| 5 | POST invalid | 400 + details | ✅ 400, 3 details |
| 6 | PUT /movies/1 | 200, all replaced | ✅ 200, "Inception: Updated Edition" |
| 7 | PUT missing properties | 400 | ✅ 400 |
| 8 | PUT /movies/999 | 404 | ✅ 404 |
| 9 | PATCH `{"year":2011}` | 200, only year changes | ✅ 200, title/genre unchanged |
| 10 | PATCH year 1500 | 400 | ✅ 400 |
| 11 | PATCH /movies/999 | 404 | ✅ 404 |
| 12 | `?genre=sci-fi&minYear=2000&sort=year` | 200, matching only | ✅ 200, 3 movies |
| 13 | `?sort=title` | 200, alphabetical | ✅ 200 |
| 14 | `?genre=Horror` | 200, `[]` | ✅ 200, `[]` |
| 15 | `?minYear=invalid` | 400 | ✅ 400 |
| 16 | `?sort=rating` | 400 | ✅ 400 |
| 17 | DELETE /movies/1 | 204, empty body | ✅ 204 |
| 18 | DELETE /movies/1 again | 404 | ✅ 404 |
| 19 | GET /does-not-exist | 404 fallback | ✅ 404 `ROUTE_NOT_FOUND` |
| 20 | GET all after sorting | original order kept | ✅ |

### Evidence – successful requests

**POST /movies** → `201 Created`
```json
{"id":6,"title":"Arrival","year":2016,"genre":"Sci-Fi"}
```

**PUT /movies/1** with `{"title":"Inception: Updated Edition","year":2010,"genre":"Sci-Fi"}` → `200 OK`
```json
{"id":1,"title":"Inception: Updated Edition","year":2010,"genre":"Sci-Fi"}
```

**PATCH /movies/1** with `{"year":2011}` → `200 OK` (title and genre unchanged)
```json
{"id":1,"title":"Inception: Updated Edition","year":2011,"genre":"Sci-Fi"}
```

**DELETE /movies/1** → `204 No Content` (no body)
```
HTTP/1.1 204 No Content
```

**GET /movies?genre=sci-fi&minYear=2000&sort=year** → `200 OK`
```json
[{"id":1,"title":"Inception: Updated Edition","year":2011,"genre":"Sci-Fi"},
 {"id":5,"title":"Interstellar","year":2014,"genre":"Sci-Fi"},
 {"id":6,"title":"Arrival","year":2016,"genre":"Sci-Fi"}]
```

### Evidence – invalid input and missing resources

**POST** with `{"title":"","year":"not a number"}` → `400 Bad Request`
```json
{"error":{"code":"VALIDATION_ERROR","message":"Movie data is invalid",
 "details":["title must be a non-empty string","year must be a valid integer","genre is required"]}}
```

**PUT /movies/1** with only `{"title":"Inception: Updated Edition"}` → `400 Bad Request`
```json
{"error":{"code":"VALIDATION_ERROR","message":"Movie data is invalid",
 "details":["year is required","genre is required"]}}
```

**GET /movies/999** and **DELETE /movies/1 (second time)** → `404 Not Found`
```json
{"error":{"code":"MOVIE_NOT_FOUND","message":"Movie not found"}}
```

**GET /movies?minYear=invalid** → `400 Bad Request`
```json
{"error":{"code":"INVALID_QUERY_PARAMETER","message":"Query parameters are invalid",
 "details":["minYear must be an integer"]}}
```

**GET /does-not-exist** → `404 Not Found`
```json
{"error":{"code":"ROUTE_NOT_FOUND","message":"The requested route does not exist"}}
```

### Evidence – Morgan terminal output

```
Movie API running at http://localhost:3000
GET /movies 200 0.753 ms - 293
GET /movies/1 200 0.449 ms - 57
GET /movies/999 404 0.241 ms - 64
POST /movies 201 0.483 ms - 55
POST /movies 400 0.261 ms - 169
PUT /movies/1 200 0.335 ms - 74
PUT /movies/1 400 0.164 ms - 122
PUT /movies/999 404 0.283 ms - 64
PATCH /movies/1 200 0.277 ms - 74
PATCH /movies/1 400 0.169 ms - 114
PATCH /movies/999 404 0.198 ms - 64
GET /movies?genre=sci-fi&minYear=2000&sort=year 200 0.344 ms - 193
GET /movies?sort=title 200 7.056 ms - 366
GET /movies?genre=Horror 200 0.163 ms - 2
GET /movies?minYear=invalid 400 0.155 ms - 126
GET /movies?sort=rating 400 0.237 ms - 137
DELETE /movies/1 204 0.319 ms - -
DELETE /movies/1 404 0.259 ms - 64
GET /does-not-exist 404 0.149 ms - 83
GET /movies 200 0.152 ms - 291
```

_(Tip: add a screenshot of your own terminal and REST Client responses here as well.)_

---

## 4. Joi – schema validation

```js
const movieSchema = Joi.object({
  title: Joi.string().trim().min(1).required(),
  year:  Joi.number().integer().min(1888).required(),
  genre: Joi.string().trim().min(1).required()
});
```

- **How it corresponds to my manual rules:** `Joi.string().trim().min(1)` = my "non-empty string" check, `Joi.number().integer().min(1888)` = my `Number.isInteger` + lower bound, and `.required()` = my `partial === false` "is required" check. (The example schema has no upper limit; my manual version also checks `year <= currentYear + 5`, which would be `.max(...)` in Joi.) For PATCH, Joi could reuse the same schema with the fields made optional.
- **Why schemas help with many resources:** The rules are declared once in a short, readable form instead of many `if` statements. They can be reused across routes (POST/PUT/PATCH), plugged into a generic validation middleware, produce consistent error messages, and are easier to maintain and review than hand-written checks spread across the code.

---

## 5. Reflection

**Most important difference between PUT and PATCH?**
PUT replaces the whole resource and therefore needs all fields; PATCH changes only the fields that are sent and keeps the rest.

**Why should backend input always be validated?**
The client cannot be trusted – requests can come from buggy front-ends, Postman, scripts or attackers. Without validation, invalid data (an empty title, a year of `"abc"`) would enter the data store and break other parts of the app later. The backend is the last line of defence.

**What is the purpose of middleware?**
To add reusable behaviour to the request-response pipeline (parsing bodies, logging, authentication, 404 and error handling) in one place, instead of repeating it in every route.

**Why should unsuccessful requests also be tested?**
Most real bugs and security problems happen on the unhappy path. Testing 400 and 404 cases proves the API rejects bad data, returns the right status code and a consistent error format that clients can rely on – and does not crash with a 500.

**Most challenging part?**
Getting PATCH right: understanding why `if (body.year)` is wrong and `body.year !== undefined` is correct, and making sure the partial validation only checks the fields that were sent. Middleware order (fallback 404 after routes, error handler last) also needed care.

**Most important thing I learned?**
A good API is *predictable*: every endpoint returns the correct status code and the same error structure, and I can prove it with a repeatable test file instead of trusting that "it works".

---

## Final checklist

- [x] All six CRUD endpoints work
- [x] PUT and PATCH behave differently
- [x] Invalid bodies return 400
- [x] Missing movies return 404
- [x] POST returns 201
- [x] DELETE returns 204 with no body
- [x] Genre (case-insensitive) and minYear filtering work
- [x] Sorting works without modifying the original array
- [x] Morgan logs requests
- [x] Unknown routes return a JSON error
- [x] Tests are repeatable (`requests.http`)
- [x] Study diary explains what I learned
