# fresh project

### Usage

Start the project:

```
deno task start
```

This will watch the project directory and restart as necessary.

### Local database and test history

Install the locked Python dependencies and apply the schema migration:

```sh
uv sync --locked
export POSTGRES_URL=postgres://postgres:postgres@localhost:5432/postgres
.venv/bin/alembic upgrade head
```

Seed five years of irregular daily and challenge play for synthetic users:

```sh
PAGER=cat psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -v confirm_fixture_seed=1 -f fixtures/daily_history.sql
```

The fixture creates eight frequent players and 100 long-tail players. It replaces only reserved `fixture_*` daily submissions and fixture-owned challenge IDs, never real player submissions. The explicit confirmation variable is required on every run; reruns are deterministic.
