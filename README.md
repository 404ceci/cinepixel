# CinePixel — Web Development Internship Test · Pixel Breeders

A movie search app built on the public [TMDB API](https://developer.themoviedb.org/docs/getting-started).
Search for movies, open one to see its synopsis, release date and cast, create an account and rate it from 1 to 5,
change or remove the rating, and see everything you rated on its own page. Light and dark mode included.

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (Vite), React Router, TanStack Query |
| Backend | Python 3.12 + Flask, SQLAlchemy, PyJWT, Gunicorn |
| Database | PostgreSQL 16 |
| Infrastructure | Docker + Docker Compose (nginx serves the frontend) |

---

## Running it

**Requirements:** Docker with Docker Compose, and a free TMDB key
(create one at <https://www.themoviedb.org/settings/api> — either the *API Key* (v3) or the *API Read Access Token* (v4) works).

```bash
cp .env.example .env          # paste your key into TMDB_API_KEY
docker compose up --build
```

| Service | URL |
|---|---|
| App | <http://localhost:3000> |
| API (direct access) | <http://localhost:5001/api/health> |

If the key is missing from `.env`, Compose stops right away with a message saying what to set.
`SECRET_KEY` (used to sign login tokens) has a development default; set your own outside local development.

> Upgrading from an older build of this project? Ratings from before accounts existed have no owner, so on startup
> the API detects that old `ratings` table and recreates it with the current schema. To start completely fresh,
> run `docker compose down -v`.

### Without Docker (development)

```bash
# terminal 1 — database
docker compose up db            # or any local Postgres (expose port 5432)

# terminal 2 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export TMDB_API_KEY=your_key
python wsgi.py                  # http://localhost:5000

# terminal 3 — frontend
cd frontend
npm install
npm run dev                     # http://localhost:5173 (Vite proxies /api to :5000)
```

### Backend tests

```bash
cd backend && pip install -r requirements.txt && pytest -q
```

38 tests cover: search and discover, movie details, parameter validation, registration and login (including
duplicate emails, weak passwords, wrong passwords, expired and forged tokens), password hashing, the full rating
lifecycle (create → edit → list → remove), **users only seeing their own ratings**, sorting, the TMDB cache
(including the `X-Cache` header going from `MISS` to `HIT`) and how TMDB errors are translated (401, 429, 5xx,
network failure, missing key), plus upgrading a database created before accounts existed. TMDB is replaced by a fake, so tests run without internet.

---

## Requirements checklist

### Required features

| Requirement | Status | Where |
|---|---|---|
| Search bar using the TMDB API | ✅ | `HomePage.tsx` → `GET /api/movies?query=` → TMDB `/search/movie` |
| Results listing with poster and title | ✅ | `MovieCard.tsx` |
| Loading states | ✅ | Skeleton cards and modal, spinner in the search bar, "Saving…" on ratings, "Loading…" on pagination |
| Click opens a modal / detail page | ✅ | `MovieModal.tsx`, opened through `?movie=ID` in the URL |
| Synopsis, release date, cast | ✅ | Plus director, runtime, genres, tagline and original title |
| Rate if not yet rated | ✅ | 1–5 stars, saved on click |
| Edit or remove an existing rating | ✅ | Click another star to edit; removing asks for confirmation |
| Close / back button | ✅ | ✕ button, Esc key, click outside, and the browser's back button |
| Rated Movies page | ✅ | `/rated` — title, poster and your score, sortable |
| Click on a rated movie opens the modal | ✅ | Same modal, same URL pattern |

### Bonus

| Bonus | Status | Details |
|---|---|---|
| Pagination / infinite scroll | ✅ | `useInfiniteQuery` + `IntersectionObserver`, with a "Load more" button as the accessible fallback |
| Filter by genre or year | ✅ | Year works with and without a search. Genre works when browsing without a search term (see "Limitations") |
| Authentication | ✅ | Email + password accounts, hashed passwords, JWT bearer tokens, per-user ratings |
| Cache implementation | ✅ | Server-side TTL cache for TMDB responses (visible through the `X-Cache` header and `/api/health`) + client-side cache in TanStack Query |

### Extras

- **Light and dark mode**, following the system setting on the first visit and remembering the choice.
- **Shareable URLs**: the search, filters, sort order and open movie all live in the URL.
- **Accessibility**: focus trap in the modal, keyboard-operable star rating, skip link, visible focus, reduced motion respected.

### Limitations

- **Genre filter together with a text search.** TMDB's `/search/movie` doesn't accept a genre. Filtering the results
  afterwards would break pagination (a page could come back empty and the total count would be wrong). So: without
  a search term the list uses `/discover/movie`, which supports genre and year; with a search term the genre filter is
  disabled and the UI says why.
- **Database migrations.** Tables are created with `db.create_all()` when the API starts. That is enough for a project
  this size; a real project would use Alembic (Flask-Migrate) to version the schema.
- **Token in `localStorage`.** Simple and works across tabs, but readable by JavaScript if the page ever had an XSS
  bug. An `httpOnly` cookie with CSRF protection would be the next step for production. There is also no password
  reset or email verification.

---

## Architecture

```
browser ──► nginx (frontend:80)
              ├── /          → static React build (SPA)
              └── /api/*     → Flask (backend:5000) ──► TMDB
                                       │  (TTL cache in memory)
                                       └──► PostgreSQL (db:5432)
```

```
backend/
  app/
    __init__.py         create_app: config, CORS, blueprints, X-Cache header, table creation (waits for the DB)
    config.py           environment variables
    models.py           User and Rating
    auth.py             JWT creation/validation, login_required, optional current user
    tmdb.py             TMDB client (v3/v4 auth, TTL cache, hit/miss stats, error translation)
    errors.py           ApiError + handlers that return standard JSON
    routes/auth.py      register, login, me
    routes/movies.py    search, discover, details, genres, health
    routes/ratings.py   rating CRUD (signed-in user only)
  tests/                pytest with a fake TMDB and in-memory SQLite
frontend/
  src/
    api/client.ts       typed fetch wrapper, attaches the token, handles 401
    auth.tsx            session context: sign in, sign up, sign out, token check on load
    theme.ts            light/dark toggle
    hooks/useMovies.ts  queries and mutations (TanStack Query)
    hooks/useMovieModal.ts  modal state in the URL
    components/         Layout, MovieCard, MovieModal, StarRating, InfiniteSentinel, States
    pages/              HomePage, RatedPage, LoginPage
    styles/global.css   design tokens (Pixel Breeders palette, light and dark)
```

### Database

```
users                                   ratings
─────────────────────────────           ──────────────────────────────────────────
id             PK                       id            PK
email          UNIQUE                   user_id       FK → users.id (ON DELETE CASCADE)
password_hash                           movie_id      TMDB id
created_at                              score         CHECK (score BETWEEN 1 AND 5)
                                        title, poster_path, release_date
                                        created_at, updated_at
                                        UNIQUE (user_id, movie_id)
```

### API endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check + TMDB cache stats (entries, hits, misses) |
| `POST` | `/api/auth/register` | — | `{"email", "password"}` → `201 {token, user}`. 409 if the email exists |
| `POST` | `/api/auth/login` | — | `{"email", "password"}` → `200 {token, user}` |
| `GET` | `/api/auth/me` | required | The signed-in user |
| `GET` | `/api/movies?query=&page=&year=&genre=` | optional | With `query`: search. Without: popular, filterable by genre and year. Each movie includes your `user_score` when signed in |
| `GET` | `/api/movies/:id` | optional | Details + cast (first 12) + director + your `user_rating` |
| `GET` | `/api/genres` | — | TMDB genre list |
| `GET` | `/api/ratings?sort=recent\|score\|title` | required | Your rated movies |
| `GET` | `/api/ratings/:movie_id` | required | One of your ratings |
| `PUT` | `/api/ratings/:movie_id` | required | Create (201) or update (200). Body: `{"score": 1..5}` |
| `DELETE` | `/api/ratings/:movie_id` | required | Remove (204) |

---

## Technical decisions

**The frontend never calls TMDB directly.** Everything goes through Flask. That keeps the API key out of the browser,
allows caching, and lets each movie come back with the user's own score already attached (`user_score`).

**Authentication with JWT.** On sign-up or sign-in the backend returns a token signed with `SECRET_KEY` (HS256,
7-day expiry). The frontend sends it as a bearer token. The server stores no sessions — it only checks the signature
and expiry. Passwords are stored as salted hashes (werkzeug's scrypt), never as plain text. Wrong password and unknown
email return the same message, so the API doesn't reveal which emails have accounts. Expired or forged tokens return
401 with a specific code, and the frontend signs the user out. Search and details are public; rating requires an
account, and every rating query is filtered by the signed-in user.

**Two cache layers.**
- *Backend:* a `TTLCache` (10 minutes, 512 entries) in the TMDB client, guarded by a `Lock` because Gunicorn runs
  with threads. One worker with 8 threads means every request shares the same cache. Each TMDB-backed response
  carries `X-Cache: HIT|MISS`, and `/api/health` reports hits and misses, so the cache can be seen working. With
  several workers or servers, the next step would be Redis.
- *Frontend:* TanStack Query keeps searches, details and genres in memory, so going back to a search or reopening a
  movie is instant. The user id is part of the cache keys, and the cache is cleared on sign-in and sign-out, so one
  person's scores never show up for another.

**`PUT` to create and edit a rating.** Each user has at most one rating per movie, so `/api/ratings/:movie_id`
identifies the resource. `PUT` is idempotent: sending the same score twice gives the same result. The status code
tells creation (201) apart from update (200).

**The client only sends the score.** When creating a rating, the backend fetches title, poster and date from TMDB
(cached). The client can't store fake movie data, and a non-existent `movie_id` returns 404.

**Denormalized `ratings` table.** Title, poster and release date are stored with the score, so "My ratings" is
**one** database query instead of one TMDB call per movie. The trade-off: if TMDB changes a poster, the stored copy
is outdated — acceptable here.

**Integrity in the database, not just in code.** `UNIQUE (user_id, movie_id)` prevents two ratings for the same
movie, `CHECK (score BETWEEN 1 AND 5)` guards the range, and the foreign key cascades when a user is deleted.
The API validates too, but the database is the last line of defense. A duplicate sign-up racing another is caught
by the unique constraint on `email`. Scores for a page of results come from **one** `IN (...)` query, avoiding N+1.

**React state, by kind.**
- *Server state* (movies, ratings) → TanStack Query: caching, loading, errors, retries, cancelling outdated requests
  and infinite pagination.
- *URL state* (search text, filters, sort, open movie) → `useSearchParams`. Reloading keeps the search, a link opens
  straight into a movie, and the browser's back button closes the modal.
- *Session* → an auth context (`useAuth`). The token is also kept at module level so the API client can attach it
  synchronously, even on the first request.
- *Local UI state* (text being typed, star hover, remove confirmation) → `useState`.

**Updating the screen after rating.** The mutation patches the movie's detail and any loaded search pages directly in
the cache (`setQueriesData`) and only invalidates the ratings list. The score badge appears on the card immediately.

**Search with a 400 ms debounce**, so typing doesn't fire a request per keystroke. Outdated requests are cancelled
through the `AbortSignal` TanStack Query passes to `fetch`.

**Errors and retries.** 4xx errors aren't retried (trying again won't help); network failures and 5xx get one
automatic retry. Every error screen has a "Try again" button. Redirects after sign-in only accept same-site paths,
which avoids open redirects.

**Theme without a flash.** A small script in `index.html` applies the theme before React loads, so dark-mode users
never see a white flash. Colors are CSS variables with the same names in both themes, so components don't know which
theme is active.

**Docker.** The frontend is built in a Node stage and served by nginx in a final image without Node. nginx also
proxies `/api`, so the browser and API share an origin (no CORS in production). Compose starts services in order
using health checks: database ready → API ready → frontend.

**Visual identity.** Colors follow the Pixel Breeders palette: purple `#6B3FA0`, logo violet `#734BE2` and lilac
`#F4EEFF`. The background is a projector-beam gradient with a faint pixel grid inside it — cinema meets pixels,
a nod to the company name. Typography: Bricolage Grotesque for headings, Figtree for text, JetBrains Mono for
labels and numbers, and Silkscreen for the wordmark.

---

## Use of AI

I used **Claude (Anthropic)** as an assistant on this project, mainly to:

- scaffold the folder structure and configuration files (Dockerfiles, Compose, nginx, Vite, TypeScript);
- write first versions of the components, endpoints and tests;
- discuss architecture options (for example, how to combine the genre filter with search, where to put the cache,
  and how to add authentication without session state on the server).

I reviewed, ran and adjusted the code, and I can explain each of the technical decisions above.

---

Movie data provided by [TMDB](https://www.themoviedb.org/). This product uses the TMDB API.
