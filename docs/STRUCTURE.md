# Repository structure

```
├── web/              Static site (HTML, CSS, JS, images) — publish this tree
├── server/           Express API, SQLite, routes, `package.json`
├── docs/             Roadmap (NEXT.md) and this overview
├── package.json      Root convenience: `npm start` → server
├── netlify.toml      Static publish root = `web`
├── index.html        Repo-root redirect to web/index.html (local convenience)
└── README.md         Project overview and quick start
```

**Local workflow:** start the API from `server/` (or `npm start` at root), then open or serve `web/index.html`.
