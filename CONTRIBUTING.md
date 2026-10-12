# Contributing

Thanks for your interest. Please read [AGENTS.md](AGENTS.md) first: it contains the safety rules that apply to every
change (no connections to real databases, no secrets, no SQL-executing features).

1. Open an issue describing the problem or the proposed rule change. Include a **synthetic** Prisma schema and,
   if relevant, a snapshot produced by `db-preflight snapshot` from a **synthetic** database. Never attach real
   snapshots or reports; they contain schema metadata.
2. Development setup and commands: [docs/development.md](docs/development.md).
3. A pull request must include tests (positive and negative cases for rules), updated docs (see the sync list in
   AGENTS.md), and a rebuilt plugin bundle (`pnpm build`).
4. New Prisma syntax support needs a fixture validated with the pinned Prisma 7 CLI (`pnpm test:prisma`).
5. New catalog queries go into `src/postgres/queries.ts` only and need integration tests on PostgreSQL 16 and 18.

By contributing you agree that your contribution is licensed under the MIT License of this project.
