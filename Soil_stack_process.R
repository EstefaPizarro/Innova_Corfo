
# Stack por profundidad de caracteristicas de suelo ----------------------
# Estefania Pizarro Arias (epizarro04@gmail.com)

# Fuente de datos raster: https://soilgrids.org/ 
# Pogio et al., 2021 (https://soil.copernicus.org/articles/7/217/2021/)


# Instalacion y carga de paquetes -----------------------------------------
#install.packages("pacman")
pacman::p_load("raster", "sf", "tidyverse")


# Carga y stack de raster -------------------------------------------------
files <- list.files("Data/Suelos/", full.names = TRUE)

# Crear un data frame para gestionar los archivos y las profundidades
df_archivos <- tibble(
  files = files,
  profundidad = str_extract(files, "\\d+_\\d+")
)

# Lista de profundidades únicas
profundidades <- unique(df_archivos$profundidad)

# Crear una lista vacía para guardar los stacks
stacks <- list()

# apilar rasters por cada profundidad y exportar
for (p in profundidades) {
  archivos_filtro <- df_archivos %>% filter(profundidad == p) %>% pull(files)
  stack_rasters <- stack(archivos_filtro)
  
  # Asignar los nombres originales de los archivos a las bandas del stack
  names(stack_rasters) <- basename(archivos_filtro)
  
  stacks[[p]] <- stack_rasters
  
  writeRaster(stack_rasters, filename = paste0("Data/Suelos/stack_soil_properties_", p, ".tif"), format = "GTiff", overwrite = TRUE)
}

# 1 : bd
# 2: clay
# 3: sand
# 4: silt
# 5: vwc1500
# 6: vwc33




