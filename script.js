// sql.js: SQLite compiled to WebAssembly, a real SQL database running inside the page.
const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
let db;

const status = document.getElementById('status');
const table = document.getElementById('results');
const stats = document.getElementById('stats');
const controls = document.getElementById('controls');
const lastSql = document.getElementById('lastSql');

// Run a query (with ? parameters) and return the rows as plain objects.
function rows(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

const SCHEMA = `
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
`;

// Where each author is from.
const COUNTRIES = {
  'Jane Austen': 'England', 'Mary Shelley': 'England', 'Herman Melville': 'United States',
  'Louisa May Alcott': 'United States', 'Mark Twain': 'United States', 'H. G. Wells': 'England',
  'Bram Stoker': 'Ireland',
};

// Ten classic books (all published before 1900).
const BOOKS = [
  { title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, genre: 'Romance', status: 'read' },
  { title: 'Emma', author: 'Jane Austen', year: 1815, genre: 'Romance', status: 'want to read' },
  { title: 'Frankenstein', author: 'Mary Shelley', year: 1818, genre: 'Horror', status: 'read' },
  { title: 'Moby-Dick', author: 'Herman Melville', year: 1851, genre: 'Adventure', status: 'reading' },
  { title: 'Little Women', author: 'Louisa May Alcott', year: 1868, genre: 'Drama', status: 'want to read' },
  { title: 'The Adventures of Tom Sawyer', author: 'Mark Twain', year: 1876, genre: 'Adventure', status: 'read' },
  { title: 'Adventures of Huckleberry Finn', author: 'Mark Twain', year: 1884, genre: 'Adventure', status: 'want to read' },
  { title: 'The Time Machine', author: 'H. G. Wells', year: 1895, genre: 'Science fiction', status: 'reading' },
  { title: 'Dracula', author: 'Bram Stoker', year: 1897, genre: 'Horror', status: 'want to read' },
  { title: 'The War of the Worlds', author: 'H. G. Wells', year: 1898, genre: 'Science fiction', status: 'read' },
];

// Add every author once, then every book pointing at its author, in one transaction.
function load() {
  db.run('PRAGMA foreign_keys = ON');
  db.run('BEGIN');
  try {
    for (const b of BOOKS) {
      db.run('INSERT OR IGNORE INTO authors (name, country) VALUES (?, ?)', [b.author, COUNTRIES[b.author]]);
      db.run(`INSERT INTO books (title, author_id, year, genre, status)
              VALUES (?, (SELECT id FROM authors WHERE name = ?), ?, ?, ?)`,
        [b.title, b.author, b.year, b.genre, b.status]);
    }
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

// Every question the app asks, in one place. Values always go in as ? parameters.
const FILTER = `FROM books
JOIN authors ON authors.id = books.author_id
WHERE (? = '' OR books.genre = ?)
  AND (books.title LIKE ? OR authors.name LIKE ?)`;

const COLUMNS = 'books.title, authors.name AS author, authors.country, books.year, books.genre, books.status';

const Q = {
  oldest: `SELECT ${COLUMNS} ${FILTER}\nORDER BY books.year`,
  title: `SELECT ${COLUMNS} ${FILTER}\nORDER BY books.title`,
  genres: 'SELECT DISTINCT genre FROM books ORDER BY genre',
  byStatus: 'SELECT status, COUNT(*) AS n FROM books GROUP BY status ORDER BY n DESC',
  summary: 'SELECT COUNT(*) AS books, MIN(year) AS oldest, MAX(year) AS newest FROM books',
  topAuthor: `SELECT authors.name, COUNT(*) AS n
FROM books JOIN authors ON authors.id = books.author_id
GROUP BY authors.id ORDER BY n DESC, authors.name LIMIT 1`,
};

// The badges above the table: totals for the whole library.
function showStats() {
  const [s] = rows(Q.summary);
  const [top] = rows(Q.topAuthor);
  const badges = [`${s.books} books`, `${s.oldest}–${s.newest}`, ...rows(Q.byStatus).map((r) => `${r.n} ${r.status}`),
    `Most books: ${top.name} (${top.n})`];
  stats.replaceChildren(...badges.map((text) => Object.assign(document.createElement('span'), { className: 'stat', textContent: text })));
}

// Draw a list of rows as an HTML table, and show the SQL that made it.
function showTable(list, sql, params = []) {
  table.replaceChildren();
  lastSql.textContent = params.length ? `${sql}\n-- parameters: ${JSON.stringify(params)}` : sql;
  if (!list.length) {
    status.textContent = 'No books match.';
    return;
  }
  status.textContent = `${list.length} book${list.length === 1 ? '' : 's'}`;
  const head = table.createTHead().insertRow();
  for (const key of Object.keys(list[0])) {
    const th = document.createElement('th');
    th.textContent = key;
    head.append(th);
  }
  const body = table.createTBody();
  for (const row of list) {
    const tr = body.insertRow();
    for (const value of Object.values(row)) tr.insertCell().textContent = value;
  }
}

function buildControls() {
  const search = document.createElement('input');
  search.type = 'search';
  search.id = 'search';
  search.placeholder = 'Search titles and authors';
  search.setAttribute('aria-label', 'Search titles and authors');

  const genre = document.createElement('select');
  genre.id = 'genre';
  genre.setAttribute('aria-label', 'Genre');
  genre.add(new Option('Every genre', ''));
  for (const g of rows(Q.genres)) genre.add(new Option(g.genre, g.genre));

  const sort = document.createElement('select');
  sort.id = 'sort';
  sort.setAttribute('aria-label', 'Sort by');
  sort.add(new Option('Oldest first', 'oldest'));
  sort.add(new Option('Title A–Z', 'title'));

  controls.append(search, genre, sort);
  search.addEventListener('input', refresh);
  genre.addEventListener('change', refresh);
  sort.addEventListener('change', refresh);
}

function refresh() {
  const g = document.getElementById('genre').value;
  const pattern = `%${document.getElementById('search').value.trim()}%`;
  const sql = Q[document.getElementById('sort').value];
  const params = [g, g, pattern, pattern];
  showTable(rows(sql, params), sql, params);
}

initSqlJs({ locateFile: (file) => SQLJS + file }).then((SQL) => {
  db = new SQL.Database();
  db.exec(SCHEMA);
  load();
  buildControls();
  showStats();
  refresh();
});
