# TableBuddy

> ⚠️ **Work in progress.** Built for one home group and its own server. Expect missing features, breaking changes and a fair amount of setup before it runs elsewhere.

A virtual tabletop **tool** for the 2024 edition of the world's most popular fantasy roleplaying game, built for a home group playing together, in person or online. The interface is in Russian.

It assists a human Dungeon Master; it is not a rules engine and does not try to replace one.

**Source-available, not open source.** Use it for your own games, paid ones and streams included; do not turn it into a service or a competing product. See [License](#license).

## What it does

- **Campaigns** — players, characters, maps and a shared chat in one place.
- **Character sheets** — created and levelled up through a step-by-step builder; armour class, hit points, spell slots, skills and saves are computed from formulas on the server.
- **Requests and verdicts** — players act through buttons (attack, cast, check, use an ability, rest). The DM sees each request with its roll and allows, fails or denies it; only then are costs spent (slots, uses, charges, ammunition) and the result posted to chat.
- **Game room** — a canvas map with tokens, grid, ruler, fog of war and an initiative order, alongside chat, the request queue, the party and an action panel.
- **Shop** — the DM opens a rolled shelf for the campaign; players buy and sell, every deal logged to chat.
- **Map library** — maps shared by every DM on the server, imported into a campaign as its own copy, monsters already placed.
- **Compendium** — browsable reference for spells, items, classes, subclasses, species, backgrounds, feats and monsters.
- **Token maker** — crop a portrait into a round token with a border.

## How it thinks

> Nothing happens automatically. Players act through buttons, the DM validates, the server computes and displays.

Rolls are computed, never applied: damage, healing and conditions stay in the DM's hands. The map is for positioning and pointing — no game logic reads it.

## Stack

| Part | Tech |
|---|---|
| Backend | Node.js, Express 5, Mongoose (MongoDB), socket.io |
| Frontend | Next.js 16 (App Router), React 19, zustand, Bootstrap / SCSS |
| Shared | Plain TypeScript in `packages/` (book loader, character builder, rules helpers, types) — no build step, imported by both apps |
| Runtime | Docker Compose, one container per app |

## Layout

```
apps/backend     REST + socket hub + formula engine
apps/frontend    Next.js app
packages/        shared code: data, builder, rules, interfaces, types, registry
packages/types/book   what a class, spell, item, feature, monster… is (the shapes every book follows)
packages/data         the book loader, plus installed books: one folder each (stub/ ships with the repo)
```

## Running

List the installed books once (and again whenever you add or remove one), then start:

```bash
node packages/data/books.js
```

```bash
docker compose up
```

Backend on `BACKEND_PORT` (4000), frontend on 4001. The compose file runs both in production mode (backend compiled with `tsc`, frontend `next build && next start`); the dev commands are kept commented next to them. After a code change, `docker compose restart <service>`. Each app also runs on its own: `cd apps/<name> && npm i && npm run dev`.

Configuration comes from environment files that are not part of the repository: a shared env (`NODE_ENV`, `SESS_NAME`, `BACKEND_PORT`, `FRONTEND_PORT`) and each app's `.env.local`:

- backend: `DB_ADDRESS`, `SESS_SECRET`, `FRONTEND_PUBLIC_URL`, optionally `REGISTRATION_CODE` (when set, signing up needs this invite code);
- frontend, optionally: `BACKEND_API_URL`, `SOCKET_PUBLIC_URL`, `ALLOWED_DEV_ORIGINS` (comma-separated hosts other than localhost that may open `next dev`).

Behind a reverse proxy, send `/` to the frontend and `/socket.io/` to the backend, both with WebSocket upgrade headers.

Backend tests: `cd apps/backend && npx jest`. Suites named `*.core.test.ts` check real rulebook entries and run only when a `core` book is installed.

## License

The TableBuddy source code is licensed under the **[PolyForm Shield License 1.0.0](LICENSE.md)**. Copyright © 2026 Dmitry (https://github.com/Dembele); see [NOTICE](NOTICE).

In plain words (this summary is not the license; [LICENSE.md](LICENSE.md) is what counts):

**You may**
- run TableBuddy for your own games, at home or online, including games you charge for;
- stream or record sessions played with it, monetised or not;
- read, change and fork the code, and share your changes under the same license with the notices kept.

**You may not**
- offer TableBuddy, or anything built from it, as a service for other people to run their games on — hosted instances, "VTT as a service", in the manner of Roll20 or Foundry hosting;
- publish or sell a product that competes with TableBuddy — another virtual tabletop, a desktop or mobile app (for example through an app store), a plugin pack marketed as a substitute;
- remove the license or the notices.

Running one server for your own group, your players included, is using it for your games, not providing a service. Offering servers or instances to other groups is.

The author keeps all other rights, including releasing TableBuddy in other forms (hosted, desktop, mobile) and under other terms. If you want to use it in a way the license does not allow, ask.

The license covers the code, including the stub book. It does not cover books you install (see below) or the third-party parts listed after it.

## Game content

**This repository contains no rulebook content.** TableBuddy reads its game content (classes, subclasses, species, backgrounds, feats, spells, items, monsters) from *books*: folders under `packages/data/` that follow the shapes in `packages/types/book/`.

- **The stub book** (`packages/data/stub/`) is what a fresh clone runs on: one original placeholder per kind of entry, enough to create a character and roll something. It is replaced as soon as any other book is installed.
- **Your own books.** Write a folder `packages/data/<name>/` with a `_book.ts` exporting `book` (the `Book` shape in `packages/types/book/book.ts`; the stub is a working example), then run `node packages/data/books.js`. Several books are merged: a core ruleset, an expansion, your homebrew. Ids are type-checked against whatever is installed.
- **Rights.** Content you put into a book is yours to answer for: game rules and text published by others belong to them. Every folder under `packages/data/` except `stub/` is ignored by this repository's git, so books stay in their own (private) repositories.

Dungeons & Dragons, D&D and Wizards of the Coast are trademarks of Wizards of the Coast LLC. TableBuddy is unofficial fan-made software and is not affiliated with, endorsed, sponsored or approved by Wizards of the Coast.

## Third-party parts

- **Dependencies** (npm packages) keep their own licenses, almost all MIT, ISC, Apache-2.0 or BSD. The image library `sharp` ships `libvips` under LGPL-3.0.
- **Icons** come through [react-icons](https://react-icons.github.io/react-icons/) (MIT):
  - [Font Awesome Free](https://fontawesome.com) icons are licensed CC BY 4.0;
  - [Game-icons.net](https://game-icons.net) icons are by Lorc, Delapouite and contributors, licensed CC BY 3.0.
- **Background images** in `apps/frontend/public/` are AI-generated.
- **Monster token art** is made by hand on each server and is not part of the repository.

## Contributing

Issues and pull requests are welcome. By submitting a contribution you agree that it is licensed to the author under the same terms as the project, and that the author may also release it under other terms (for example in a future desktop or mobile app), so the project can keep a single owner.
