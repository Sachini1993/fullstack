from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel, Field

app = FastAPI(
    title="Movies API",
    description="Week 3: the Express movies REST API ported to Python FastAPI.",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class MovieCreate(BaseModel):
    """Data the client must send to create (POST) or fully replace (PUT) a movie."""
    title: str = Field(min_length=1, examples=["Arrival"])
    director: str = Field(min_length=1, examples=["Denis Villeneuve"])
    year: int = Field(ge=1888, le=2100, examples=[2016])


class MovieUpdate(BaseModel):
    """Data for a partial update (PATCH). Every field is optional."""
    title: str | None = Field(default=None, min_length=1)
    director: str | None = Field(default=None, min_length=1)
    year: int | None = Field(default=None, ge=1888, le=2100)


class Movie(BaseModel):
    """A stored movie as returned by the API: server-generated id + editable fields."""
    id: int
    title: str
    director: str
    year: int


# ---------------------------------------------------------------------------
# In-memory "database" (same idea as the array in the Express version)
# ---------------------------------------------------------------------------

movies: list[dict] = [
    {"id": 1, "title": "Inception", "director": "Christopher Nolan", "year": 2010},
    {"id": 2, "title": "Interstellar", "director": "Christopher Nolan", "year": 2014},
    {"id": 3, "title": "The Matrix", "director": "Lana Wachowski, Lilly Wachowski", "year": 1999},
    {"id": 4, "title": "Parasite", "director": "Bong Joon-ho", "year": 2019},
]
next_id = len(movies) + 1


def find_movie(movie_id: int) -> dict:
    """Return the movie with the given id, or raise 404 Not Found."""
    for movie in movies:
        if movie["id"] == movie_id:
            return movie
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Movie with id {movie_id} not found",
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"message": "Hello from FastAPI"}


@app.get("/movies", response_model=list[Movie])
def get_movies(
    min_year: int | None = None,
    director: str | None = None,
):
    """GET all movies. Optional filters: ?min_year=2000 and/or ?director=nolan"""
    result = movies

    if min_year is not None:
        result = [movie for movie in result if movie["year"] >= min_year]

    if director is not None:
        result = [
            movie for movie in result
            if director.lower() in movie["director"].lower()
        ]

    return result


@app.get("/movies/{movie_id}", response_model=Movie)
def get_movie(movie_id: int):
    """GET one movie by id. 200 OK if found, 404 Not Found otherwise."""
    return find_movie(movie_id)


@app.post("/movies", response_model=Movie, status_code=status.HTTP_201_CREATED)
def create_movie(movie: MovieCreate):
    """POST a new movie. The server generates the id. Returns 201 Created."""
    global next_id
    new_movie = {"id": next_id, **movie.model_dump()}
    next_id += 1
    movies.append(new_movie)
    return new_movie


@app.put("/movies/{movie_id}", response_model=Movie)
def replace_movie(movie_id: int, movie: MovieCreate):
    """PUT: completely replace a movie. All editable fields are required; the id is kept."""
    existing = find_movie(movie_id)
    existing.clear()
    existing.update({"id": movie_id, **movie.model_dump()})
    return existing


@app.patch("/movies/{movie_id}", response_model=Movie)
def update_movie(movie_id: int, movie: MovieUpdate):
    """PATCH: update only the fields the client actually sent."""
    existing = find_movie(movie_id)
    # exclude_unset=True -> only fields that were present in the request body
    changes = movie.model_dump(exclude_unset=True)
    # Ignore explicit nulls so a field can never be "erased" by PATCH
    changes = {key: value for key, value in changes.items() if value is not None}
    existing.update(changes)
    return existing


@app.delete("/movies/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_movie(movie_id: int):
    """DELETE a movie. 204 No Content on success, 404 Not Found if missing."""
    movie = find_movie(movie_id)
    movies.remove(movie)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
