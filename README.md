# Psychedelic

An interactive psychedelic color field. Move your mouse or drag your finger across the screen and the colors swirl and churn.

**Live demo:** [nickanderson038.github.io/psychedelic-web-app](https://nickanderson038.github.io/psychedelic-web-app/)

## How it works

- Dependency-free HTML + CSS + vanilla JS on a 2D `<canvas>`.
- A particle field drifts continuously; pointer movement injects velocity and a tangential swirl force into nearby particles, and hues cycle over time.
- Trails build through low-alpha compositing with additive blending.
- Mouse and touch via Pointer Events; DPR-aware; bounded particle count.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy-pages.yml`, which publishes this site to GitHub Pages.
