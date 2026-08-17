# Instant Translator

Instant Translator is a quick response text translation web app.

## Engineering Principles

- Do not preserve backwards compatibility.
  Remove obsolete paths instead of adding compatibility layers, migrations.
- Choose the simplest implementation that fully meets the current requirements.
  Avoid speculative abstractions, configuration, and indirection.
- Keep components modular and concerns clearly separated.
- Make architecture decisions for the long term.
  Do not accept stopgap that only works for now and is meant to be replaced later.

## Commits, issues, and pull requests
Issue titles, PR titles, and commit messages share the same format.
Each is a concise English one-liner following Conventional Commits,
e.g. `feat(match): add typo-tolerant matching`, `fix(zle): clear listing on accept-line`.
A change is titled once.
The issue names it first,
and the PR reuses that title as the squash-merge commit message.
Bodies may be written in English or Japanese.

Issue bodies must be self-contained.
Open with a paragraph or two stating the current state, the change, and the reason.
Avoid vocabulary that only made sense in the conversation that spawned the issue.
When referencing other issues, write `#N` plus a short description.
