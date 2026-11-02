# Book Library

**▶ [Try it live](https://theoyanvno.github.io/sql-library/)**

A book library backed by a real SQL database. The page runs SQLite in the browser with [sql.js](https://github.com/sql-js/sql.js), creates two tables, loads ten classic books, and lets you filter by genre, search titles and authors, sort, and see summary counts. The SQL behind each view is shown under the table.

## What it shows

- `CREATE TABLE` with types, `PRIMARY KEY`, `NOT NULL`, `DEFAULT` and `CHECK`
- `INSERT` with `?` parameters inside a transaction (`BEGIN` / `COMMIT` / `ROLLBACK`)
- `SELECT` with `WHERE`, `DISTINCT`, `ORDER BY` and `LIKE`
- `COUNT`, `MIN` and `MAX` with `GROUP BY`
- An `authors` table, a foreign key (`author_id REFERENCES authors(id)`) and `JOIN`

## Tables

```sql
CREATE TABLE authors (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL
);

CREATE TABLE books (
  id        INTEGER PRIMARY KEY,
  title     TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  year      INTEGER NOT NULL,
  genre     TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'want to read'
            CHECK (status IN ('want to read', 'reading', 'read'))
);
```

## Run it

Open `index.html` in a browser (it loads sql.js from cdnjs, so it needs an internet connection), or use VS Code's Live Server.

---

Built with help from AI coding tools, as part of my learning and portfolio.
