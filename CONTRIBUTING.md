# Contributing to Plotwise

Thanks for your interest in improving Plotwise. This guide covers how to set up the project, make changes, and submit them.

## Before you start

- Check [existing issues](https://github.com/LucaBonaldoIT/plotwise/issues) to avoid duplicating work.
- For anything beyond a small fix, open an issue first to discuss the change.
- For security vulnerabilities, do **not** open a public issue; follow [SECURITY.md](SECURITY.md).

## Development setup

Requirements: Node.js 20+ and npm 10+.

```sh
git clone https://github.com/LucaBonaldoIT/plotwise.git
cd plotwise
npm install
npm run webapp:dev
```

| Path                     | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| `apps/webapp/`           | Vite browser app: one HTML page per chapter            |
| `apps/webapp/src/lib/`   | Statistics, PCA, t-SNE, chart scaffolding and controls |
| `apps/webapp/src/pages/` | The labs of each chapter                               |

## Making changes

1. Fork the repository and create a branch from `main`, for example `feat/boxplot-lab` or `fix/slider-touch`.
2. Make focused changes. Keep unrelated refactors out of the same pull request.
3. Check every lab you touched in both light and dark themes, on desktop and at phone width.
4. Verify locally before pushing:

   ```sh
   npm run format:check    # formatting
   npm run webapp:build    # confirm the production build succeeds
   ```

5. Open a pull request against `main`.

## Code guidelines

- Plain JavaScript modules; match the style of the surrounding code (naming, comment density, idiom).
- Statistics and algorithms belong in `src/lib`, not in the pages. The labs should consume them.
- Use the design system's role tokens (`--ds-*`) and the chart helpers in `src/lib/chart.js` for colors, so everything follows the theme.
- Avoid adding runtime dependencies without discussing them first. The project is intentionally dependency-light.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add a lab for the interquartile range
fix: slider track not responding to taps on iOS
docs: update README
```

Use the imperative mood, keep the subject under about 72 characters, and explain _why_ in the body when it is not obvious.

## Pull requests

A good pull request:

- Describes what changed and why.
- Links the related issue, if any.
- Includes screenshots or a short recording for UI changes.
- Passes the checks listed above.

## Licensing of contributions

Plotwise is released under the MIT [`LICENSE`](LICENSE). By submitting a contribution, you agree that it may be distributed under these terms.

Do not contribute code you do not have the right to license.
