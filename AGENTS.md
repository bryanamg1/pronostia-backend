# AGENTS

- Respect `blueprint-celula-hibrida.md` as the functional source of truth.
- Preserve the backend layered architecture: `config`, `domain`, `application`, `infrastructure`, `presentation`, `shared`.
- Start every public task from `develop`.
- Use branches named `bryan/<type>/<short-name>`.
- Allowed branch types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- Require explicit authorization before starting or merging a phase.
- Keep business rules out of routes, controllers, middlewares, repositories, and HTTP clients.
- Run tests and required validations before merge.
- Do not expose secrets in code, documentation, commits, or logs.
- Do not implement automatic betting flows or live betting behavior.
- OpenAI may explain deterministic results in future phases, but must not calculate core probabilities.
- Do not include private local operational information in tracked repository files.
