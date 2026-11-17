// dotenv must be loaded before db.js, because the Pool reads process.env when it is created
require("dotenv").config({ quiet: true });

const express = require("express");
const morgan = require("morgan");
const pool = require("./db");

const app = express();

app.use(express.json());
app.use(morgan("dev"));

// Columns returned to the client. release_year is renamed to year so the
// JSON shape stays the same as in the Week 3 in-memory version.
const MOVIE_COLUMNS = `
    id,
    title,
    director,
    release_year AS year
`;

// Allow-list for ?sortBy=. Column names cannot be sent as $1 parameters,
// so only these server-defined names may ever become part of the SQL text.
const SORT_COLUMNS = {
    id: "id",
    year: "release_year",
    title: "title"
};

// Allow-list for PATCH: client field name -> database column name
const allowedFields = {
    title: "title",
    director: "director",
    year: "release_year"
};

// ---------- helpers ----------

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function isValidYear(value) {
    return Number.isInteger(value) && value >= 1888 && value <= 2100;
}

// Validates a movie body. With { partial: true } only the provided fields
// are checked (used by PATCH). Returns an array of error messages.
function validateMovie(movie, { partial = false } = {}) {
    const errors = [];

    if (movie === null || typeof movie !== "object" || Array.isArray(movie)) {
        return ["Request body must be a JSON object"];
    }

    if (!partial || movie.title !== undefined) {
        if (!isNonEmptyString(movie.title)) {
            errors.push("title is required and must be a non-empty string");
        } else if (movie.title.trim().length > 200) {
            errors.push("title must be at most 200 characters");
        }
    }

    if (!partial || movie.director !== undefined) {
        if (!isNonEmptyString(movie.director)) {
            errors.push("director is required and must be a non-empty string");
        } else if (movie.director.trim().length > 200) {
            errors.push("director must be at most 200 characters");
        }
    }

    if (!partial || movie.year !== undefined) {
        if (!isValidYear(movie.year)) {
            errors.push("year is required and must be an integer between 1888 and 2100");
        }
    }

    return errors;
}

// ---------- health ----------

app.get("/health/database", async (req, res, next) => {
    try {
        const result = await pool.query(
            "SELECT NOW() AS database_time"
        );

        res.json({
            status: "ok",
            databaseTime: result.rows[0].database_time
        });
    } catch (error) {
        next(error);
    }
});

// ---------- movies ----------

// GET /movies?director=...&year=...&sortBy=id|year|title&order=asc|desc
app.get("/movies", async (req, res, next) => {
    try {
        const { director, year, sortBy = "id", order = "asc" } = req.query;

        const conditions = [];
        const values = [];

        if (director !== undefined) {
            values.push(director);
            conditions.push(`LOWER(director) = LOWER($${values.length})`);
        }

        if (year !== undefined) {
            const yearNumber = Number(year);
            if (!Number.isInteger(yearNumber)) {
                return res.status(400).json({ error: "year must be an integer" });
            }
            values.push(yearNumber);
            conditions.push(`release_year = $${values.length}`);
        }

        const sortColumn = SORT_COLUMNS[sortBy];
        if (!sortColumn) {
            return res.status(400).json({
                error: `sortBy must be one of: ${Object.keys(SORT_COLUMNS).join(", ")}`
            });
        }

        const direction = String(order).toLowerCase();
        if (direction !== "asc" && direction !== "desc") {
            return res.status(400).json({ error: "order must be asc or desc" });
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        // id is a tie-breaker so the order is always predictable
        const result = await pool.query(
            `SELECT ${MOVIE_COLUMNS}
             FROM movies
             ${whereClause}
             ORDER BY ${sortColumn} ${direction.toUpperCase()}, id ASC`,
            values
        );

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET /movies/:id
app.get("/movies/:id", async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({ error: "id must be a positive integer" });
        }

        const result = await pool.query(
            `SELECT ${MOVIE_COLUMNS}
             FROM movies
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Movie not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST /movies
app.post("/movies", async (req, res, next) => {
    try {
        const errors = validateMovie(req.body);
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const { title, director, year } = req.body;

        // PostgreSQL generates the id
        const result = await pool.query(
            `INSERT INTO movies (
                title,
                director,
                release_year
            )
            VALUES ($1, $2, $3)
            RETURNING ${MOVIE_COLUMNS}`,
            [title.trim(), director.trim(), year]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// PUT /movies/:id - full replacement, every field required
app.put("/movies/:id", async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({ error: "id must be a positive integer" });
        }

        const errors = validateMovie(req.body);
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const { title, director, year } = req.body;

        const result = await pool.query(
            `UPDATE movies
             SET
                 title = $1,
                 director = $2,
                 release_year = $3
             WHERE id = $4
             RETURNING ${MOVIE_COLUMNS}`,
            [title.trim(), director.trim(), year, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Movie not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// PATCH /movies/:id - partial update with controlled dynamic SQL
app.patch("/movies/:id", async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({ error: "id must be a positive integer" });
        }

        const body = req.body;
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
            return res.status(400).json({ error: "Request body must be a JSON object" });
        }

        const fields = Object.keys(body);
        if (fields.length === 0) {
            return res.status(400).json({ error: "PATCH body must contain at least one field" });
        }

        const unknownFields = fields.filter((field) => !(field in allowedFields));
        if (unknownFields.length > 0) {
            return res.status(400).json({
                error: `Unknown field(s): ${unknownFields.join(", ")}. Allowed: ${Object.keys(allowedFields).join(", ")}`
            });
        }

        const errors = validateMovie(body, { partial: true });
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const setClauses = [];
        const values = [];

        for (const field of fields) {
            // The column name comes from the server-side allow-list, never from the client
            const column = allowedFields[field];
            const value = typeof body[field] === "string" ? body[field].trim() : body[field];

            values.push(value);
            setClauses.push(`${column} = $${values.length}`);
        }

        values.push(id);

        const result = await pool.query(
            `UPDATE movies
             SET ${setClauses.join(", ")}
             WHERE id = $${values.length}
             RETURNING ${MOVIE_COLUMNS}`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Movie not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// DELETE /movies/:id
app.delete("/movies/:id", async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({ error: "id must be a positive integer" });
        }

        const result = await pool.query(
            `DELETE FROM movies
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Movie not found" });
        }

        // 204 must not have a body
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

// ---------- unknown routes and centralized error handling ----------

app.use((req, res) => {
    res.status(404).json({ error: "Unknown endpoint" });
});

// Must be registered after all routes
app.use((error, req, res, next) => {
    // Malformed JSON body sent by the client
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Malformed JSON in request body" });
    }

    console.error(error);

    // Database server not reachable
    if (error.code === "ECONNREFUSED") {
        return res.status(503).json({ error: "Database unavailable" });
    }

    // PostgreSQL error codes: 22xxx = invalid data, 23xxx = constraint violation
    if (typeof error.code === "string" && /^2[23]/.test(error.code)) {
        return res.status(400).json({ error: "Invalid data", detail: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
