# Implementation Plan: home page night sky

## Overview
Two stages. **Stage A (overnight, 5–6 Oct 2026):** a switcher prototype ("lab") over the real home page, covering every variant in SPEC-home-night-sky.md, published as a private Artifact and runnable locally. **Stage B (after Maasoom picks):** port only the chosen fx into `src/` within the budget, test, and hand over for deploy under his routine (he saves and publishes).

## Architecture decisions
- **The lab reuses the real build** (`dist/preview/home.html`) with relative assets, so every variant is judged against the true page and hero, not a mock-up.
- **State lives in the URL hash, and each switch reloads the page** (keeping the scroll position). The fx modules then need no teardown, which keeps them short.
- **One file pair per fx, with a fixed `mount(ctx)` contract.** Seven agents build in parallel without touching each other's files (`lab/README.md`).
- **Fake 3D only.** cobe (5.7 KB, MIT) is the only new library and appears only in the globe variant.
- **The port is Stage B.** Nothing in `src/` changes overnight, so `main` and the live site are untouched.

## Task list
See `tasks/todo.md`.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Combined fx exceed the 8 KB JS headroom | High | Measure each fx in the lab. Removing the band-desk code frees about 2 KB. Ask before any budget change. |
| Busy page around the hero | Med | Motion rule, one moment per screen, review on both iterations |
| Second WebGL context (globe) on course.link | Med | Pause off screen. If the context is lost, fall back to the coin or a still mark. Live check before saving. |
| Artifact sandbox blocks something (history API, module imports) | Low | Local lab is the fallback and is described in the morning summary |
| Higgsfield clip quality | Low | 30-credit cap with one retry; placeholder if poor |
