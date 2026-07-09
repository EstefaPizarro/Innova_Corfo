// FUNCIONES DE CALCULO DE INDICES ESPECTRALES OPTICOS

var spectral = require("users/dmlmont/spectral:spectral");

// 1. Función para calcular índices opticos en Sentinel-2 (con spectral)-------------------------------------------------------------------
exports.calcularIndiceOptS2 = function(image) {

  var parameters = {
    "N"  : image.select("B8"),
    "R"  : image.select("B4"),
    "G"  : image.select("B3"),
    "N2" : image.select("B8A"),
    "RE1": image.select("B5"),
    "S2" : image.select("B12"),
    "L": 0.5
};

  // Calcula el índice utilizando spectral.computeIndex
  var indiceCalculado = spectral.computeIndex(image,["NDVI","SAVI","SLAVI","SeLI"],parameters);

  return indiceCalculado
};


// 2. Función para calcular índices opticos en Landsat-8 (con spectral)-------------------------------------------------------------------
exports.calcularIndiceOptL8 = function(image) {

  var parameters = {
    "N"  : image.select("SR_B5"),
    "R"  : image.select("SR_B4"),
    "G"  : image.select("SR_B3"),
    "S2" : image.select("SR_B7"),
    "L": 0.5
};

  // Calcula el índice utilizando spectral.computeIndex
  var indiceCalculado = spectral.computeIndex(image,["NDVI","SAVI","SLAVI"],parameters);

  return indiceCalculado
};
