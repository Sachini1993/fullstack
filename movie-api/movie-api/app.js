const express = require("express");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Data (in-memory array) ----------
let movies = [
  { id: 1, title: "Inception", year: 2010, genre: "Sci-Fi" },
  { id: 2, title: "The Matrix", year: 1999, genre: "Sci-Fi" },
  { id: 3, title: "Parasite", year: 2019, genre: "Thriller" },
  { id: 4, title: "Amelie", year: 2001, genre: "Comedy" },
  { id: 5, title: "Interstellar", year: 2014, genre: "Sci-Fi" }
];
let nextId = 6;

// ---------- Middleware ----------
// Task 4.2: own simple logger (used for testing, now disabled so requests are not logged twice)
function simpleLogger(req, res, next) {
  console.log(req.method, req.originalUrl);
  next();
}
// app.use(simpleLogger);

app.use(express.json());
app.use(morgan("dev"));

// ---------- Helpers ----------
function validateMovie(body, partial = false) {
  const errors = [];
  const maximumYear = new Date().getFullYear() + 5;

  if (!partial && body.title === undefined) {
    errors.push("title is required");
  }
  if (
    body.title !== undefined &&
    (typeof body.title !== "string" || body.title.trim().length === 0)
  ) {
    errors.push("title must be a non-empty string");
  }

  if (!partial && body.year === undefined) {
    errors.push("year is required");
  }
  if (
    body.year !== undefined &&
    (!Number.isInteger(body.year) || body.year < 1888 || body.year > maximumYear)
  ) {
    errors.push("year must be a valid integer");
  }

  if (!partial && body.genre === undefined) {
    errors.push("genre is required");
  }
  if (
    body.genre !== undefined &&
    (typeof body.genre !== "string" || body.genre.trim().length === 0)
  ) {
    errors.push("genre must be a non-empty string");
  }

  return errors;
}

function sendValidationError(res, details) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Movie data is invalid",
      details
    }
  });
}

function sendNotFound(res) {
  return res.status(404).json({
    error: {
      code: "MOVIE_NOT_FOUND",
      message: "Movie not found"
    }
  });
}

function findMovieIndex(idParam) {
  const id = Number(idParam);
  return movies.findIndex((m) => m.id === id);
}

// ---------- Routes ----------
// GET /movies  (?genre=, ?minYear=, ?sort=year|title)
app.get("/movies", (req, res) => {
  const { genre, minYear, sort } = req.query;
  const details = [];

  let minYearNumber;
  if (minYear !== undefined) {
    minYearNumber = Number(minYear);
    if (minYear.trim() === "" || !Number.isInteger(minYearNumber)) {
      details.push("minYear must be an integer");
    }
  }
  if (sort !== undefined && !["year", "title"].includes(sort)) {
    details.push("sort must be either 'year' or 'title'");
  }
  if (details.length > 0) {
    return res.status(400).json({
      error: {
        code: "INVALID_QUERY_PARAMETER",
        message: "Query parameters are invalid",
        details
      }
    });
  }

  let result = [...movies]; // copy, the original array is never reordered

  if (genre !== undefined) {
    result = result.filter((m) => m.genre.toLowerCase() === genre.toLowerCase());
  }
  if (minYearNumber !== undefined) {
    result = result.filter((m) => m.year >= minYearNumber);
  }
  if (sort === "year") {
    result.sort((a, b) => a.year - b.year);
  } else if (sort === "title") {
    result.sort((a, b) => a.title.localeCompare(b.title));
  }

  res.status(200).json(result);
});

// GET /movies/:id
app.get("/movies/:id", (req, res) => {
  const index = findMovieIndex(req.params.id);
  if (index === -1) return sendNotFound(res);
  res.status(200).json(movies[index]);
});

// POST /movies
app.post("/movies", (req, res) => {
  const body = req.body || {};
  const errors = validateMovie(body, false);
  if (errors.length > 0) return sendValidationError(res, errors);

  const newMovie = {
    id: nextId++,
    title: body.title.trim(),
    year: body.year,
    genre: body.genre.trim()
  };
  movies.push(newMovie);
  res.status(201).json(newMovie);
});

// PUT /movies/:id  (full replacement)
app.put("/movies/:id", (req, res) => {
  const index = findMovieIndex(req.params.id);
  if (index === -1) return sendNotFound(res);

  const body = req.body || {};
  const errors = validateMovie(body, false);
  if (errors.length > 0) return sendValidationError(res, errors);

  const replaced = {
    id: movies[index].id, // id is preserved
    title: body.title.trim(),
    year: body.year,
    genre: body.genre.trim()
  };
  movies[index] = replaced;
  res.status(200).json(replaced);
});

// PATCH /movies/:id  (partial update)
app.patch("/movies/:id", (req, res) => {
  const index = findMovieIndex(req.params.id);
  if (index === -1) return sendNotFound(res);

  const body = req.body || {};
  const errors = validateMovie(body, true);
  if (errors.length > 0) return sendValidationError(res, errors);

  const movie = movies[index];
  if (body.title !== undefined) movie.title = body.title.trim();
  if (body.year !== undefined) movie.year = body.year;
  if (body.genre !== undefined) movie.genre = body.genre.trim();

  res.status(200).json(movie);
});

// DELETE /movies/:id
app.delete("/movies/:id", (req, res) => {
  const index = findMovieIndex(req.params.id);
  if (index === -1) return sendNotFound(res);

  movies.splice(index, 1);
  res.status(204).end(); // no body
});

// ---------- Fallbacks (must be after the routes) ----------
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "The requested route does not exist"
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  // Malformed JSON body sent by the client
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON"
      }
    });
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred"
    }
  });
});

app.listen(PORT, () => {
  console.log(`Movie API running at http://localhost:${PORT}`);
});
