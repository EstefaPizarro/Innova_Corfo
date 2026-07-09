

# Extraccion de caracteristicas de suelo ----------------------------------
# Estefania Pizarro Arias (epizarro04@gmail.com)

# Instalacion y carga de paquetes -----------------------------------------
pacman::p_load("raster", "sf", "tidyverse")


# Carga de datos vectoriales ----------------------------------------------
predios <- st_read("Data/roi/df_predios/df_predios.shp")


# Carga de datos raster ---------------------------------------------------

# Listar todos los archivos stack en la carpeta
files <- list.files("Data/Suelos/", pattern = "tif", full.names = TRUE)

# Cargar en stack todos los archivos
soil <- stack(files)/10  # pasar a porcentaje


# Extraer informacion -----------------------------------------------------
df <- raster::extract(soil, predios, df = TRUE, fun = "mean") 

df$fid <- predios$fid

xs <- df %>% as_tibble() %>%
  select(fid,contains(c("clay", "sand", "silt")))

writexl::write_xlsx(xs, "Data/Suelos/df_suelos.xlsx")
