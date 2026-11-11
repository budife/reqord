# Public View & Auto-Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** reqord auto-syncs edits to Supabase and exposes a public read-only board.

**Architecture:** Wire the existing `debouncedSync()` into `saveItems()` and call `sbSyncAll()` right after a folder scan. Add a standalone `public.html` + `public.js` + `public.css` that reads `work_orders` through the anon key and renders a read-only board grouped by status.

**Tech Stack:** Vanilla JS, Supabase JS v2 (CDN), GitHub Pages.

**Spec:** `PRD-public-view.md`

## Global Constraints

- No new dependencies.
- Keep GitHub Pages + Supabase (anon key is public).
- Public page: no login, no edit controls, never render `note`.
- UI copy in Indonesian.

## Task 1: Auto-sync wiring

**Files:** `app.js`

- `saveItems()` calls `debouncedSync()` so every scan/edit/status/priority/subitem change syncs after 5 seconds.
- `scanFolderHandle()` calls `sbSyncAll()` immediately after new items are added.

**Verify:** `node --check app.js` and `node test/app-smoke.test.js`.

## Task 2: Public board page

**Files:** `public.html` (create), `public.js` (create), `public.css` (create)

- Fetch `work_orders` (columns: `requestor`, `title`, `status`, `priority`, `month`, `request_date`, `date`) via the anon client.
- Group by status: list, ongoing, preview, revision, done.
- Search + month filter + realtime subscription.
- Read-only, no login.

**Verify:** `node --check public.js`.

## Task 3: Link + docs

**Files:** `index.html`, `README.md`, `CHANGELOG.md`, `MEMORY.md`

- Add a "Public board" link in the app.
- Update docs.

**Verify:** `node --check app.js`, smoke test.
