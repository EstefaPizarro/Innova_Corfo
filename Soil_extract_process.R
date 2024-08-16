

# Extraccion de caracteristicas de suelo ----------------------------------
# Estefania Pizarro Arias (epizarro04@gmail.com)

# Instalacion y carga de paquetes -----------------------------------------
pacman::p_load("raster", "sf", "tidyverse","rgdal")


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
  select(fid,contains(c("clay", "sand", "silt"))) #%>% 
  # rowwise() %>%
  # mutate(CLAY = mean(c_across(starts_with("clay")), na.rm = TRUE),
  #        SAND = mean(c_across(starts_with("sand")), na.rm = TRUE),
  #        SILT = mean(c_across(starts_with("silt")), na.rm = TRUE)) %>%
  # ungroup() %>% 
  # select(fid, CLAY, SAND, SILT, clay_0_5, clay_5_15, clay_15_30, clay_30_60, clay_60_100, clay_100_200,
  #        sand_0_5, sand_5_15, sand_15_30, sand_30_60, sand_60_100, sand_100_200,
  #        silt_0_5, silt_5_15, silt_15_30, silt_30_60, silt_60_100, silt_100_200)

writexl::write_xlsx(xs, "Data/Suelos/df_suelos.xlsx")
