# YoRHa Task Planner

A NieR: Automata-inspired task planner web app built with vanilla **HTML, CSS, and JavaScript**. It provides a themed directive/task dashboard with due dates, a monthly mission calendar, sub-directives, search/filtering, and local browser persistence.

> **Theme note:** This is a fan-made UI inspired by the NieR: Automata aesthetic. It is not affiliated with or endorsed by Square Enix.

## Features

### Task management
- **Create directives** with an optional due date
- **Edit directives** (text and due date) inline
  - Quick date actions: `Today`, `Tomorrow`, `Next Week`, `Clear Date`
- **Complete / reopen** directives
- **Delete directives** with **Undo** toast
- **Purge completed directives** with confirmation and **Undo**

### Sub-directives (subtasks)
- Add sub-directives to any task
- Toggle sub-directive completion independently
- **Edit** and **delete** sub-directives
- **Progress tracking** per task (`x/y` count + visual progress bar)

### Search & filtering
- **Search** across directive text and sub-directive text
- **Status filters:** `All`, `Active`, `Completed`
- **Advanced filters** (combinable):
  - `Overdue`
  - `Due Today`
  - `Has Subtasks`
  - `No Due Date`
- **Clear Filters** resets search, status/advanced filters, and selected calendar date

### Calendar & planning views
- **Monthly calendar** with previous/next navigation and `Today` shortcut
- Date markers showing number of due directives
- **Overdue indicators** on calendar days
- **Select a date** to filter the task list by due date (toggle to clear)
- **Day Agenda panel** for the selected date (status and subtask summary)
- **Operational summary** stats: Total, Active, Completed, Overdue

### UI & experience
- YoRHa-inspired visual design (tactical panels, typography, scanline/grid styling, themed states/badges)
- Responsive layout for desktop and smaller screens
- In-app toast notifications for undo actions
- Local persistence via browser `localStorage`

## Project structure

```text
.
├── index.html   # App markup and templates
├── styles.css   # YoRHa-themed styling and responsive layout
├── app.js       # App logic, rendering, filtering, calendar, persistence
└── README.md    # Project documentation
```

## Getting started

### Prerequisites
- A modern web browser (Chrome, Edge, Firefox, Safari)
- No build tools or dependencies required

### Run locally
1. Download or clone this repository.
2. Open `index.html` in your browser.

That’s it — the app runs as a static site.

#### Optional: run with a local server
You can also serve the folder locally (recommended for development workflows):

```bash
# Python 3
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Usage

1. **Add a directive:** Enter a task in the input field, optionally choose a due date, and click `REGISTER`.
2. **Edit a directive:** Click `EDIT` on a task to update its text/due date (or use quick date buttons), then `SAVE`.
3. **Manage completion:** Use the checkbox to mark a directive or sub-directive complete/active.
4. **Add sub-directives:** Use the "Add sub-directive..." field inside a task card.
5. **Filter tasks:** Use search, status tabs, advanced filter chips, and/or click a calendar date.
6. **View day agenda:** Select a date in the calendar to see directives assigned to that day in the side panel.
7. **Undo actions:** Use the `UNDO` toast after deleting a directive or purging completed directives.

## Data storage

- Tasks are stored in your browser’s `localStorage` under the key: `yorha-task-planner-v1`
- Data persists on the same browser/device/profile unless cleared
- Existing stored tasks are normalized/migrated on load to support newer fields (e.g. due dates, sub-directives)

> Note: Clearing browser site data/storage for this page will remove saved tasks.

## Deploy (GitHub Pages)

Because this is a static app, it can be hosted easily with GitHub Pages:

1. Push the project to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` (or your default branch), folder `/ (root)`
4. Save and wait for the site to publish.

## Known limitations

- No cloud sync or multi-device sync (local browser storage only)
- No drag-and-drop reordering/rescheduling (yet)
- No recurring tasks, notes field, import/export, or notifications (yet)

## License

No license file is included yet. Add a `LICENSE` file if you plan to share or distribute this project publicly.
