# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A data science project (Diplomado en Data Ciencia — Taller de Proyecto, Estefanía Pizarro Arias) estimating crop water needs / ET of citrus orchards ("Innova Corfo") from satellite vegetation indices, topography, soil, and meteorological data. It is a pipeline of Google Earth Engine scripts, R scripts, and Colab notebooks — there is no application code, build system, package manifest, or test suite.

## Pipeline (run in this order)

1. **`1_GEE/` (JavaScript, run in the GEE Code Editor, not locally)**
   - `LS_process.js` — main script. Pulls Sentinel-2 (`COPERNICUS/S2_SR_HARMONIZED`) and Landsat-8 (`LANDSAT/LC08/C02/T1_L2`) imagery over the study region/orchard polygons (`predios`, keyed by `fid`), cloud-masks it, computes vegetation indices, clips to each `predios` polygon, and exports time-series CSVs (`S2_time_series`, `L8_time_series`), plus orchard area and topographic derivatives (elevation/slope/hillshade from SRTM), to a Google Drive folder (`VI_Innova_Corfo`).
   - `fx_cloudmask.js` — GEE module (imported via `require('users/epizarro04/Innova_Corfo:Funciones/fx_cloudmask')`) with `s2cloudmask_scl` (Sentinel-2 SCL-band cloud mask) and `maskL8sr_qa` (Landsat-8 QA_PIXEL cloud/saturation mask + surface reflectance scaling).
   - `fx_calculo_indices.js` — GEE module for spectral index calculation, built on the community `users/dmlmont/spectral:spectral` library. Computes NDVI/SAVI/SLAVI/SeLI for Sentinel-2 and NDVI/SAVI/SLAVI for Landsat-8.
   - These three files must stay in sync with their counterparts in the GEE Code Editor asset repo (`users/epizarro04/Innova_Corfo:Funciones/...`); editing them here does not change the deployed GEE assets.

2. **`2_Suelo/` (R scripts, SoilGrids processing, run locally in R with `pacman`/`raster`/`sf`/`tidyverse`)**
   - `Soil_stack_process.R` — stacks SoilGrids depth-interval rasters (bulk density, clay, sand, silt, vwc1500, vwc33) from `Data/Suelos/` by depth interval into per-depth GeoTIFFs. Runs first.
   - `Soil_extract_process.R` — extracts mean raster values per orchard polygon (`Data/roi/df_predios/df_predios.shp`) from the stacked soil rasters, producing `Data/Suelos/df_suelos.xlsx`. Depends on the stacks produced by `Soil_stack_process.R`.
   - `Data/` is a local/Drive-relative path expected by these scripts; it is not present in this repo.

3. **`3_Notebooks/Serie_diaria_VI.ipynb`** (Python, Google Colab) — harmonizes the Sentinel-2 and Landsat-8 index series exported in step 1 (method after Beeri et al., 2020): filters by the 3 study seasons, LOESS-smooths NDVI/SAVI/SLAVI per `fid`/season, builds a daily date range per season (fixed to each season's calendar start/end, not the min/max observed date per `fid`), and linearly interpolates to daily resolution. Outputs `df_indices.xlsx`.

4. **`3_Notebooks/Segunda_entrega_EPizarro.ipynb`** (Python, Google Colab) — main analysis notebook. Loads all upstream outputs (orchard/`huertos` metadata, `df_indices` from step 3, topographic derivatives, `df_suelos` from step 2, hourly meteo data), joins them into `df_vi_meteo` (daily-varying data) and `df_const` (static per-orchard data), then `df_full`. Performs per-table and joined EDA (nulls, distributions, correlation matrices/heatmaps, pairplots via the shared `plot_correlacion`/`plot_distribuciones` helpers) and a PCA over candidate modeling variables (NDVI, SAVI, SLAVI, GDD, meteo, topography, soil texture).

5. **`ml-to-eta-of-citrus-orchards.7z`** — archived bundle of project data/code found online, not authored in this repo; kept at the repo root and gitignored.

## Key data-model concepts

- **`fid`** — unique id of an orchard sub-plot/quarter (`predios`/`cuartel`), the join key across nearly all tables.
- **`stationId`** — links an orchard (`fid`) to its meteorological station; used to join `df_indices` with meteo data.
- **`season`** — analysis is scoped to 3 fixed growing seasons (e.g. `2021-09-01`–`2022-04-30`); satellite and meteo data are filtered/joined per season, not on raw calendar dates.
- Vegetation indices in use: NDVI, SAVI, SLAVI, SeLI (Sentinel-2 only); missing/no-data values from GEE reductions are sentineled as `-9999` before being filtered out.

## Git workflow

The user makes all commits themselves. Do not run `git commit`, `git add`, or `git push` — instead, give the user the exact commands to run.

## Working in this repo

- There is no install/build/lint/test tooling — treat each notebook/script as a standalone, sequentially-executed pipeline stage rather than an importable codebase.
- Notebooks are designed to run in Google Colab and mount Google Drive (`/content/drive/MyDrive/Diplomado_DS/Segunda_entrega/Data_set/...`) for all data I/O; file paths will not resolve outside Colab.
- `Segunda_entrega_EPizarro.ipynb` grows large from embedded plot output as it's re-run in Colab; read/edit it by extracting specific cells (e.g. via `nbformat`/`json`) rather than loading it whole when possible — the Read tool will refuse it whole past a certain size.
