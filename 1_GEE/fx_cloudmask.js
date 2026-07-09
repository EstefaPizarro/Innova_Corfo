// FUNCIONES PARA MASCARA DE NUBES

// 1. Funcion para aplicar mascara de nubes usando la banda SCL de Sentinel-2.-----------------------------
// Ejemplo completo: https://code.earthengine.google.com/8dad8e9d7297138ab691aa04fa05336d
//https://docs.digitalearthafrica.org/en/latest/data_specs/Sentinel-2_Level-2A_specs.html


exports.s2cloudmask_scl= function(img) {
// Selecting the SCL (Scene Classification Band)
var scl = img.select('SCL');
// Selecting the cloud shadow and cloud masks (3,7,8,9);
var saturate = scl.eq(1);
var cloud_shadow = scl.eq(3);
//var cloud_low = scl.eq(7);
var cloud_medium = scl.eq(8);
var cloud_high = scl.eq(9);
var cirrus = scl.eq(10);
// Merging the masks together
//var cloud_mask = cloud_shadow.add(cloud_low).add(cloud_medium).add(cloud_high).add(cirrus).add(saturate);
var cloud_mask = cloud_shadow.add(cloud_medium).add(cloud_high).add(cirrus).add(saturate);

// Creating a uniary mask image from the binary mask image i.e. replacing the black with nulls
var cloud_uni = cloud_mask.eq(0).selfMask(); //0 are cloud less features while 1 is cloud and
//...cloud shadow. SelfMask is added to ignore 0
//if you want inverted mask set the bit value to 0
// Finally masking the orignal image (or bands) with cloud mask
var cloud_masked = img.updateMask(cloud_uni).divide(10000)
      .select("B.*")
      .copyProperties(img, ["system:time_start"]);
      
return cloud_masked
}


// 2. Función para enmascarar nubes de Landsat 8 (Collection 2, Level 2) -------------------------

exports.maskL8sr_qa = function (img) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = img.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = img.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = img.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = img.select('ST_B.*').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return img.addBands(opticalBands, null, true)
      .addBands(thermalBands, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}
