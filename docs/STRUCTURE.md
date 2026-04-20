# Repository structure

```
├── web/                 # Static site (HTML, CSS, JS, images) — deploy this folder
├── server/              # Node.js Express API (SQLite, JWT)
├── docs/                # Roadmap and notes (e.g. NEXT.md)
├── index.html           # Optional redirect at repo root → web/index.html
├── README.md
└── netlify.toml         # publish = web
```

Local development: run the API from `server/`, then open **`web/index.html`** with Live Server (or any static server rooted at `web/`).
