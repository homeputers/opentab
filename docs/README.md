# OpenTab Docs

## Run locally

From the repository root:

```bash
cd docs
npm install
npm run dev -- --host 0.0.0.0 --port 4321
```

Then open `http://localhost:4321/opentab/` if you are using the default `BASE_PATH` for GitHub Pages, or `http://localhost:4321/` if you override `BASE_PATH` to `/`.

You can also build and preview the production output:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4321
```

## Analytics configuration

The docs site reads analytics identifiers from environment variables:

- `PUBLIC_GA_MEASUREMENT_ID` for Google Analytics.
- `PUBLIC_GTM_ID` for Google Tag Manager.

## GitHub Pages deployment

The GitHub Pages site is built and deployed by `.github/workflows/docs.yml`.

- The workflow runs on pushes to `main` that touch `docs/**`, `spec/**`, or `samples/**`.
- It installs dependencies, then builds the site with `BASE_PATH=/<repo-name>/` and `SITE=https://homeputers.com/opentab`.
- The static output in `docs/dist` is uploaded and deployed via GitHub Pages.

If you need to test Pages routing locally, set `BASE_PATH=/<repo-name>/` and `SITE=https://homeputers.com/opentab` before running `npm run dev` or `npm run build`.
