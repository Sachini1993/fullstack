"""Automated version of the Task 5 Swagger checks.

Run with:  python test_api.py
(Requires httpx:  python -m pip install httpx)
"""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def show(label, response):
    body = response.text if response.text else "(no body)"
    print(f"{label:<40} {response.status_code}  {body[:110]}")


r = client.get("/movies");                      show("GET all", r);                    assert r.status_code == 200 and len(r.json()) == 4
r = client.get("/movies/1");                    show("GET existing (id 1)", r);        assert r.status_code == 200
r = client.get("/movies/999");                  show("GET missing (id 999)", r);       assert r.status_code == 404
r = client.get("/movies/abc");                  show("GET with non-int id", r);        assert r.status_code == 422

r = client.post("/movies", json={"title": "Arrival", "director": "Denis Villeneuve", "year": 2016})
show("POST valid", r);                          assert r.status_code == 201 and r.json()["id"] == 5
r = client.post("/movies", json={"title": "Arrival", "director": "Denis Villeneuve", "year": "not a year"})
show("POST invalid year", r);                   assert r.status_code == 422
r = client.post("/movies", json={"title": "Arrival"})
show("POST missing fields", r);                 assert r.status_code == 422

r = client.put("/movies/5", json={"title": "Dune", "director": "Denis Villeneuve", "year": 2021})
show("PUT complete", r);                        assert r.status_code == 200 and r.json()["id"] == 5 and r.json()["title"] == "Dune"
r = client.put("/movies/5", json={"title": "Dune"})
show("PUT incomplete", r);                      assert r.status_code == 422
r = client.put("/movies/999", json={"title": "X", "director": "Y", "year": 2000})
show("PUT missing id", r);                      assert r.status_code == 404

r = client.patch("/movies/5", json={"year": 2022})
show("PATCH year only", r);                     assert r.json() == {"id": 5, "title": "Dune", "director": "Denis Villeneuve", "year": 2022}
r = client.patch("/movies/999", json={"year": 2022})
show("PATCH missing id", r);                    assert r.status_code == 404

r = client.delete("/movies/5");                 show("DELETE existing", r);            assert r.status_code == 204
r = client.get("/movies/5");                    show("GET deleted movie", r);          assert r.status_code == 404
r = client.delete("/movies/5");                 show("DELETE again", r);               assert r.status_code == 404

r = client.get("/movies?min_year=2010");        show("Query min_year=2010", r);        assert len(r.json()) == 3
r = client.get("/movies?director=nolan");       show("Query director=nolan", r);       assert len(r.json()) == 2
r = client.get("/movies?min_year=2015&director=nolan"); show("Query both filters", r); assert r.json() == []
r = client.get("/movies?min_year=abc");         show("Query invalid min_year=abc", r); assert r.status_code == 422

print("\nAll checks passed.")
