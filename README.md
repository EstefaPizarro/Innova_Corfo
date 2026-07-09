# Innova Corfo — Estimación de necesidades hídricas en huertos de cítricos

Proyecto de ciencia de datos (Diplomado en Data Science, Taller de Proyecto — Estefanía Pizarro Arias) que combina imágenes satelitales, topografía, propiedades de suelo y datos meteorológicos para estudiar el comportamiento vegetacional (vía índices de vegetación) de cuarteles de huertos de cítricos, como insumo para estimar su demanda hídrica (evapotranspiración, ET).

No es una aplicación de software: es un **pipeline de procesamiento de datos** compuesto por scripts de Google Earth Engine, scripts de R y notebooks de Python (Google Colab), que se ejecutan en orden, uno alimentando al siguiente.

## ¿Por dónde parto?

Si es la primera vez que ves este repo, el orden de lectura recomendado es:
1. Esta sección (para entender la idea general).
2. "El flujo completo, paso a paso" más abajo.
3. Abrir los archivos de la carpeta correspondiente a la etapa que te interese.

## Idea general del pipeline

```
 1_GEE/                2_Suelo/                3_Notebooks/
 (Earth Engine,        (R, corre localmente)   (Python, corre en Google Colab)
  corre en la nube)

 Sentinel-2 ┐
 Landsat-8  ├─► índices de    SoilGrids ─► stack ─► extracción   Series NDVI/SAVI/SLAVI
 DEM        │   vegetación,   por profundidad      por cuartel   ─► armonización S2+L8
            │   topografía                         (arcilla,        ─► suavizado LOESS
 Polígonos ─┘   por cuartel                          arena, limo)    ─► interpolación diaria
 de cuarteles                                                            │
      │                              │                                  ▼
      └──────────────► CSV/XLSX ◄────┘                     Integración con huertos,
      (exportados a Google Drive)                          topografía, suelo y clima
                                                             ─► EDA ─► PCA
```

Cada etapa **exporta archivos** (CSV o Excel) que la siguiente etapa **lee desde Google Drive**. No hay una sola ejecución "de punta a punta": cada script/notebook se corre por separado y a mano, en el orden que se describe abajo.

## El flujo completo, paso a paso

### 1. `1_GEE/` — Extracción satelital (Google Earth Engine)

Estos scripts **no se ejecutan localmente**: se pegan en el [GEE Code Editor](https://code.earthengine.google.com/) y corren en la nube de Google. No tienen forma de "instalarse" ni de correr con Node — la extensión `.js` es solo para que el editor de texto/GitHub los resalte como código.

| Archivo | Qué hace |
|---|---|
| `fx_cloudmask.js` | Funciones para enmascarar nubes: `s2cloudmask_scl` (Sentinel-2, usa la banda SCL) y `maskL8sr_qa` (Landsat-8, usa la banda QA_PIXEL + reescala reflectancia de superficie). |
| `fx_calculo_indices.js` | Calcula los índices espectrales NDVI, SAVI, SLAVI y SeLI (este último solo para Sentinel-2), usando la librería comunitaria `spectral`. |
| `LS_process.js` | **Script principal.** Filtra Sentinel-2 y Landsat-8 por la región de estudio y fecha, aplica las máscaras de nubes, calcula los índices, recorta cada imagen a los polígonos de los cuarteles (`predios`, identificados por `fid`), extrae series temporales por cuartel y exporta todo a una carpeta de Google Drive (`VI_Innova_Corfo`) como CSV: series de Sentinel-2, series de Landsat-8, área de cada cuartel y derivadas topográficas (elevación, pendiente, hillshade) desde el DEM SRTM. |

**Cómo correrlo:** copiar el contenido de `LS_process.js` en el GEE Code Editor (los `require()` a `fx_cloudmask` y `fx_calculo_indices` apuntan a los mismos scripts ya guardados como *assets* en la cuenta de GEE del proyecto: `users/epizarro04/Innova_Corfo:Funciones/...`). Si edits los archivos acá, hay que copiar el cambio también al editor de GEE — no se sincronizan solos.

**Salida:** `Area_predio.csv`, `Var_topograficas.csv`, `S2_time_series.csv`, `L8_time_series.csv` en Google Drive.

### 2. `2_Suelo/` — Propiedades físicas del suelo (R, se corre en tu computador)

Usa datos de [SoilGrids](https://soilgrids.org/) (Poggio et al., 2021): rasters de arcilla, arena, limo, densidad aparente y contenido de agua, a distintas profundidades.

| Archivo | Qué hace | Orden |
|---|---|---|
| `Soil_stack_process.R` | Agrupa los rasters descargados de SoilGrids por profundidad y los apila en un único GeoTIFF por profundidad. | 1° |
| `Soil_extract_process.R` | Lee el shapefile de los cuarteles, extrae el valor promedio de cada raster apilado dentro de cada polígono, y exporta el promedio de arcilla/arena/limo por cuartel a Excel. | 2° (depende del anterior) |

**Requisitos:** R con los paquetes `pacman`, `raster`, `sf`, `tidyverse`, `writexl` (se instalan automáticamente vía `pacman::p_load(...)` si no están). Ambos scripts esperan una carpeta `Data/` (con `Data/Suelos/` y `Data/roi/df_predios/df_predios.shp`) que **no está incluida en este repo** — hay que tenerla localmente antes de correr los scripts.

**Salida:** `Data/Suelos/df_suelos.xlsx`.

### 3. `3_Notebooks/Armonizacion_interpolacion_diaria_VI.ipynb` — Serie diaria de índices de vegetación (Python, Google Colab)

Junta las series de Sentinel-2 y Landsat-8 exportadas en el paso 1 y las convierte en **una serie diaria continua** por cuartel, siguiendo el método de Beeri et al. (2020):

1. Lee `S2_time_series.csv` y `L8_time_series.csv` desde Drive.
2. Filtra las fechas a las 3 temporadas de riego en estudio (`21-22`, `22-23`, `23-24`: 1 de septiembre a 30 de abril de cada temporada).
3. Junta ambos satélites en una sola tabla, ordenada por cuartel y fecha, sin duplicados.
4. Aplica **suavizado LOESS** (regresión local ponderada) a NDVI, SAVI y SLAVI, por cuartel y temporada, para atenuar el ruido entre pasadas de satélite.
5. Construye un rango de fechas **diario y fijo** para cada temporada (del 1 de septiembre al 30 de abril, igual para todos los cuarteles) e **interpola linealmente** los valores suavizados a resolución diaria.
6. Grafica un ejemplo (cuartel 8, temporada 22-23) comparando datos crudos, suavizados e interpolados.
7. Exporta el resultado.

**Cómo correrlo:** abrir en Google Colab, montar Google Drive cuando lo pida (`drive.mount(...)`), y correr las celdas en orden. Las rutas de lectura están fijas a `/content/drive/MyDrive/Diplomado_DS/Segunda_entrega/Data_set/...`, así que solo funciona con esa estructura de carpetas en el Drive de la cuenta del proyecto.

**Salida:** `df_indices.xlsx` (se descarga al notebook y también queda disponible para el siguiente paso).

### 4. `3_Notebooks/Integracion_datos_EDA_PCA.ipynb` — Integración y análisis exploratorio (Python, Google Colab)

El notebook principal de análisis. Junta **todas** las fuentes de datos y explora sus relaciones:

1. **Carga** 5 tablas: metadata de huertos/cuarteles (`df_huertos.xlsx`), la serie diaria de índices del paso 3 (`df_indices.xlsx`), derivadas topográficas del paso 1 (`df_topo.csv`), propiedades de suelo del paso 2 (`df_suelos.xlsx`) y datos meteorológicos horarios (`clima_analytics.csv`).
2. **Preprocesa** cada tabla: convierte área a hectáreas, deriva arcilla/arena/limo promedio del perfil completo de suelo, filtra el clima a las 3 temporadas de estudio y calcula variables agronómicas derivadas: días-grado acumulados (GDD) y déficit de presión de vapor (DPV).
3. **Describe** cada tabla por separado (`.info()`, `.describe()`, conteo de nulos).
4. **Integra** todo en dos tablas:
   - `df_vi_meteo`: variables que cambian día a día (índices de vegetación + clima), unidas por `stationId` + `date` + `season`.
   - `df_const`: variables constantes por cuartel (huerto, topografía, suelo), unidas por `fid`.
   - `df_full`: la unión de ambas.
5. **Explora** cada tabla integrada con pairplots, matrices de correlación/heatmaps y distribuciones/boxplots por variable (usando las funciones auxiliares `plot_correlacion` y `plot_distribuciones` definidas una sola vez y reutilizadas para las 3 tablas).
6. **PCA**: selecciona variables candidatas para modelar (índices de vegetación, GDD, DPV, topografía, textura de suelo), las estandariza y aplica análisis de componentes principales para ver cuánta varianza explican y qué variables cargan más en cada componente.

**Cómo correrlo:** igual que el notebook anterior — Colab + Drive montado, mismas rutas de `Data_set/`.

## Conceptos clave del modelo de datos

Para no perderte entre tablas, estas son las llaves y variables que aparecen una y otra vez:

- **`fid`**: identificador único de cada cuartel/sub-parcela de un huerto. Es la llave principal para unir casi todas las tablas.
- **`stationId`**: identifica la estación meteorológica asociada a cada huerto. Sirve para unir los índices de vegetación con el clima.
- **`season`**: el análisis está acotado a 3 temporadas de riego fijas (ej. `21-22` = 1 sep 2021 al 30 abr 2022). Los datos satelitales y meteorológicos siempre se filtran/unen por temporada, no por fecha calendario libre.
- **Índices de vegetación**: NDVI, SAVI, SLAVI (Sentinel-2 y Landsat-8) y SeLI (solo Sentinel-2). Cuando Earth Engine no logra calcular un valor (nube, sin intersección), se marca como `-9999` y luego se filtra.
- **`timeline`**: día acumulado dentro de la temporada (0, 1, 2, ...), útil para comparar cuarteles en el mismo punto de su ciclo fenológico en vez de por fecha calendario.

## Estructura del repositorio

```
1_GEE/                                        # Etapa 1 — Google Earth Engine (nube)
  fx_cloudmask.js
  fx_calculo_indices.js
  LS_process.js
2_Suelo/                                       # Etapa 2 — R local
  Soil_stack_process.R
  Soil_extract_process.R
3_Notebooks/                                   # Etapas 3 y 4 — Python / Google Colab
  Armonizacion_interpolacion_diaria_VI.ipynb
  Integracion_datos_EDA_PCA.ipynb
```

## Cosas a tener en cuenta

- No hay instalador ni pipeline automatizado: cada etapa se corre a mano, en orden, y depende de que la salida de la etapa anterior ya esté en el Google Drive del proyecto.
- Los notebooks solo funcionan dentro de Google Colab con el Drive del proyecto montado — las rutas de lectura están escritas en duro (`/content/drive/MyDrive/Diplomado_DS/Segunda_entrega/Data_set/...`).
- Los scripts de R esperan una carpeta local `Data/` que no viene en este repo.
- Los scripts de `1_GEE/` viven también como *assets* dentro de la cuenta de Google Earth Engine del proyecto; si los editas acá, hay que replicar el cambio a mano en el Code Editor de GEE.
