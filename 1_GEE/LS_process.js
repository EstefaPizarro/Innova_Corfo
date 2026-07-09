/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var sentinel2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED"),
    landsat8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
    region = ee.FeatureCollection("projects/ee-epizarro04/assets/Innova_Corfo/Region"),
    dem = ee.Image("USGS/SRTMGL1_003"),
    predios = ee.FeatureCollection("projects/ee-epizarro04/assets/Innova_Corfo/df_predios");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
/*
DESCARGA DE SERIES TEMPORALES NDVI, SAVI Y SLAVI DERIVADO DE
DE SENTINEL-2 Y LANDSAT-8 PARA LOS CUARTELES EN ESTUDIO.
ANEXO DE DESCARGA DE DERIVADAS TOPOGRÁFICAS

Estefanía Pizarro Arias (epizarro04@gmail.com)
*/

//------------------------------------------------------------------------------------------------------------------
// 1. FUNCIONES 
// ------------------------------------------------------------------------------------------------------------------

// Funciones para enmascarar nubes. Specify module with cloud mask functions.
var fx_cloudmask = require('users/epizarro04/Innova_Corfo:Funciones/fx_cloudmask');

// Funciones para calcular indices
var fx_calculo_indices = require('users/epizarro04/Innova_Corfo:Funciones/fx_calculo_indices');

// Funcion para recortar
function corte_lim(image) {
  var corte = image.clip(region)
  return corte
}

//-----------------------------------------------------------------------------------------------------------------          
// 2. PROSESAMIENTO DE SATELITES
//------------------------------------------------------------------------------------------------------------------
var startDate = '2019-08-01';
var endDate   = '2024-05-30';

// Sentinel-2
var s2_region = sentinel2.filterBounds(region)
                  .filterDate(startDate,endDate)
                  .filterMetadata("CLOUDY_PIXEL_PERCENTAGE", "less_than", 30)
                  .map(fx_cloudmask.s2cloudmask_scl)
                  .select('B3','B4','B5','B8','B8A','B12')
                  .map(fx_calculo_indices.calcularIndiceOptS2)
                  .map(corte_lim);
                    
// print(s2_region)    
 
// Landsat-8
var l8_region = landsat8.filterBounds(region)
                       .filterDate(startDate,endDate)
                       .filterMetadata("CLOUD_COVER","less_than", 30)
                       .map(fx_cloudmask.maskL8sr_qa)
                       .select('SR_B3','SR_B4','SR_B5','SR_B7')
                       .map(fx_calculo_indices.calcularIndiceOptL8)
                       .map(corte_lim);
                  
// print(l8_region)

// Topografia
 var topo = ee.Terrain.products(dem).clip(region)

//------------------------------------------------------------------------------------------------------------                
// 3. PROCESAMIENTO POLIGONOS PREDIOS
//------------------------------------------------------------------------------------------------------------

// We need a unique id for each polygon. We take the feature id and set it as
// a property so we can refer to each polygon easily
var prediosFid = predios.map(function(feature) {
  return ee.Feature(feature.geometry(),
  {//'id': feature.id(),
  'fid': feature.get('fid')
  });
});
print(prediosFid)

// Area
var prediosConArea = prediosFid.map(function(feature) {
  var area = feature.geometry().area().divide(10000); // Área en hectáreas
  return ee.Feature(feature.geometry(), {
    //'id': feature.id(),
    'fid': feature.get('fid'),
    'area': area
  });
});

// Imprimir la colección de features para verificar
print(prediosConArea);


//------------------------------------------------------------------------------------------------------------                
// 4. EXTRACCION DE SERIES TEMPORALES
//------------------------------------------------------------------------------------------------------------

// SENTINEL-2

// Extraer información de la coleccion de VI para los diferentes poligonos 
var extraccionS2 = s2_region.map(function(image) {
  return image.select("NDVI","SAVI","SLAVI","SeLI").reduceRegions({
    collection: prediosFid,
    reducer: ee.Reducer.mean(), 
    scale: 10,
  })// reduceRegion doesn't return any output if the image doesn't intersect with the point or if the image is masked out due to cloud
    // If there was no ndvi value found, we set the ndvi to a NoData value -9999
    .map(function(feature) {
    var ndvi = ee.List([feature.get('NDVI'),-9999])
      .reduce(ee.Reducer.firstNonNull());
    var savi = ee.List([feature.get('SAVI'), -9999])
      .reduce(ee.Reducer.firstNonNull());
    var slavi  = ee.List([feature.get('SLAVI'),-9999])
      .reduce(ee.Reducer.firstNonNull());
    var seli  = ee.List([feature.get('SeLI'),-9999])
      .reduce(ee.Reducer.firstNonNull());
    return feature.set({'NDVI' : ndvi, 
                        'SAVI' : savi,
                        'SLAVI': slavi,
                        'SeLI' : seli,
                        'imageID': image.id()})
                  .set({//'id': feature.id(),
                        'fid': feature.get('fid')
                  });
    });
  }).flatten();


// The result is a 'tall' table. We can further process it to extract the date from the imageID property.
var extraccionWithDateS2 = extraccionS2.map(function(f) {
  var imageID = f.get('imageID');
  var date = ee.String(imageID).slice(0,8);
  return f.set('date', date)
})

// For a cleaner table, we can also filter out null values, remove duplicates and sort the table
// before exporting.
var extraccionFilteredS2 = extraccionWithDateS2
  .filter(ee.Filter.neq('NDVI', -9999))
  .distinct(['fid', 'date'])
  .sort('fid');


// LANDSAT-8

// Extraer información de la coleccion de VI para los diferentes poligonos 
var extraccionL8 = l8_region.map(function(image) {
  return image.select('NDVI','SAVI','SLAVI').reduceRegions({
    collection: prediosFid,
    reducer: ee.Reducer.mean(), 
    scale: 30,
  }).map(function(feature) {
    var ndvi = ee.List([feature.get('NDVI'),-9999])
      .reduce(ee.Reducer.firstNonNull());
    var slavi = ee.List([feature.get('SLAVI'), -9999])
      .reduce(ee.Reducer.firstNonNull());
    var savi  = ee.List([feature.get('SAVI'),-9999])
      .reduce(ee.Reducer.firstNonNull());
    return feature.set({'NDVI' : ndvi, 
                        'SLAVI': slavi, 
                        'SAVI' : savi, 
                        'imageID': image.id()})
                  .set({'fid': feature.get('fid')});
    });
  }).flatten();

var extraccionWithDateL8 = extraccionL8.map(function(f) {
  var imageID = f.get('imageID');
  var date = ee.String(imageID).slice(12,20);
  return f.set('date', date)
})

var extraccionFilteredL8 = extraccionWithDateL8
  .filter(ee.Filter.neq('NDVI', -9999))
  .distinct(['fid', 'date'])
  .sort('fid');

//------------------------------------------------------------------------------------------------------------
// 5. EXTRACCION DATOS TOPOGRAFIA
//------------------------------------------------------------------------------------------------------------
 
 var extraccionTopo = topo.select('elevation','slope','hillshade')
  .reduceRegions({
    collection: prediosFid,
    reducer: ee.Reducer.mean(), 
    scale: 10,
  });

//------------------------------------------------------------------------------------------------------------                
// 6. EXPORTAR INFORMACIÓN
//------------------------------------------------------------------------------------------------------------

// Area predios
Export.table.toDrive({
    collection: prediosConArea,
    description: 'Area_predio',
    folder: 'VI_Innova_Corfo',
    fileNamePrefix: 'Area_predio',
    fileFormat: 'CSV',
    selectors: ['fid', 'area']
})

// Variables topograficas
Export.table.toDrive({
    collection: extraccionTopo,
    description: 'Var_topograficas',
    folder: 'VI_Innova_Corfo',
    fileNamePrefix: 'Var_topograficas',
    fileFormat: 'CSV',
    selectors: ['fid', 'elevation','slope','hillshade']
})

// Serie Sentinel-2
Export.table.toDrive({
    collection: extraccionFilteredS2,
    description: 'VI_SENTINEL2',
    folder: 'VI_Innova_Corfo',
    fileNamePrefix: 'S2_time_series',
    fileFormat: 'CSV',
    selectors: ['fid', 'date','NDVI','SAVI','SLAVI']
})

// Serie Landsat-8
Export.table.toDrive({
    collection: extraccionFilteredL8,
    description: 'VI_LANDSAT8',
    folder: 'VI_Innova_Corfo',
    fileNamePrefix: 'L8_time_series',
    fileFormat: 'CSV',
    selectors: ['fid', 'date', 'NDVI','SAVI','SLAVI']
})