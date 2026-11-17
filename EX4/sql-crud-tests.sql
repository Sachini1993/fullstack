-- Task 3.2: SQL CRUD tests. Run these one at a time in pgAdmin Query Tool
-- after running database.sql. Screenshot or copy the results into your study diary.

-- 1. Select all movies
SELECT *
FROM movies
ORDER BY id;

-- 2. Select one movie by ID
SELECT *
FROM movies
WHERE id = 1;

-- 3. Insert a new movie
INSERT INTO movies (
    title,
    director,
    release_year
)
VALUES (
    'Arrival',
    'Denis Villeneuve',
    2016
)
RETURNING *;

-- 4. Update a movie
UPDATE movies
SET release_year = 2017
WHERE id = 4
RETURNING *;

-- 5. Delete a movie
DELETE FROM movies
WHERE id = 4
RETURNING *;

-- Check the final state
SELECT *
FROM movies
ORDER BY id;
