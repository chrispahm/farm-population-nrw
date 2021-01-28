const fs = require('fs')
const d3 = require('d3')
const turf = require('@turf/turf');
const allFarms = require('./Farm_Population_NRW_assigned_plots_kdbush.json')
const community_polygons = require('../nuts3.json').features;

console.log(allFarms.length);
const cleanFarms = []
const features = []
const unfinished = []

const allCrops = [
  'Getreide',
  'Hackfrüchte',
  'Ackerfutter',
  'Ölsaaten',
  'Eiweißpflanzen',
  'Dauerkulturen',
  'Zierpflanzen',
  'Gemüse',
  'Energiepflanzen'
]
const cropsEng = {
  'Getreide': 'Wheats',
  'Hackfrüchte': 'RootCrops',
  'Ackerfutter': 'ArableFodder',
  'Ölsaaten': 'Oilseeds',
  'Eiweißpflanzen': 'ProteinCrops',
  'Dauerkulturen': 'PermanentCrops',
  'Zierpflanzen': 'OrnamentalPlants',
  'Gemüse': 'Vegetables',
  'Energiepflanzen': 'EnergyCrops',
  'Dauergrünland': 'Grassland'
}

function round(no) {
  if (!no || isNaN(no)) return 0
  return Math.round(no * 100)/100
}

let countUnfinished = 0
let totalArea = 0

allFarms.filter(f => f._plots).forEach((farm,i) => {
  const farmId = farm._bwa + '_' + farm._bkr + '_' + i
  const communityData = community_polygons.find(c => replaceUmlaute(c.properties.GEN) === farm._community)

  const farmData = {
    farmId: farmId,
    index: farm._index,
    bwa: farm._bwa,
    bkr: farm._bkr,
    community: farm._community,
    ags: communityData.properties.AGS,
    nuts: communityData.properties.NUTS,
    cows: round(farm._cows),
    bulls: round(farm._bulls),
    pigs: round(farm._pigs),
    sows: round(farm._sows)
  }
  
  farmData.aspiredFarmSize = farm._aspiredFarmSize
  farmData.farmSize = round(d3.sum(farm._plots.map(p => p.properties.MEA_HA)))
  farmData.aspiredArableLand = farm._aspiredArableLand
  farmData.aspiredGrasLand = farm._aspiredGrasLand

  farmData.farmSize = round(d3.sum(farm._plots.map(p => p.properties.MEA_HA)))
  farmData.arableLand = round(d3.sum(farm._plots.filter(p => p.properties.D_USE !== 'Dauergrünland').map(p => p.properties.MEA_HA)))
  farmData.grassLand = round(d3.sum(farm._plots.filter(p => p.properties.D_USE === 'Dauergrünland').map(p => p.properties.MEA_HA)))

  farmData.avgPlotSize = round(d3.mean(farm._plots.map(p => p.properties.MEA_HA)))
  farmData.medianPlotSize = round(d3.median(farm._plots.map(p => p.properties.MEA_HA)))
  farmData.deviationPlotSize = round(d3.deviation(farm._plots.map(p => p.properties.MEA_HA)))

  farmData.lng = farm._location.geometry.coordinates[0]
  farmData.lat = farm._location.geometry.coordinates[1]

  allCrops.forEach(crop => {
    farmData[cropsEng[crop]] = round(d3.sum(farm._plots.filter(p => p.properties.D_USE === crop).map(p => p.properties.MEA_HA))) || 0
  })

  if (farmData.farmSize > farm._aspiredFarmSize * 0.75) {
    farmData.unfinished = false
  } else {
    countUnfinished++
    farmData.unfinished = true
  }
  
  farm._plots.forEach(plot => {
    
    plot.properties = {
      id: plot.properties.IID_LOCAL,
      plotSize: plot.properties.MEA_HA,
      FLIK: plot.properties.FLIK,
      distance: turf.distance(farm._location, turf.centroid(plot)),
      community: plot.community,
      cultivation: cropsEng[plot.properties.D_USE],
      farmId: farmId
    }
    
    totalArea += plot.properties.plotSize
    features.push(plot)
    if (farmData.unfinished) unfinished.push(plot)
  })
  
  farmData.avgPlotDistance = round(d3.mean(farm._plots.map(p => p.properties.distance * Math.sqrt(2))))
  farmData.medianPlotDistance = round(d3.median(farm._plots.map(p => p.properties.distance * Math.sqrt(2))))
  farmData.deviationPlotDistance = round(d3.deviation(farm._plots.map(p => p.properties.distance * Math.sqrt(2))))
  farmData.plots = farm._plots.map(p => p.properties.id)
  cleanFarms.push(farmData)
})
console.log(cleanFarms.length);
console.log(countUnfinished);
console.log(totalArea);

fs.writeFileSync('Farm_Population_NRW_kdbush.geojson', JSON.stringify(turf.featureCollection(features)), 'utf8')
//fs.writeFileSync('Farm_Population_NRW_kdbush_en.csv', d3.csvFormat(cleanFarms), 'utf8')
//fs.writeFileSync('Farm_Population_NRW_kdbush.csv', d3.csvFormat(cleanFarms).replace(/,/g,';').replace(/\./g,','), 'utf8')
//fs.writeFileSync('Farm_Population_NRW_kdbush.geojson', JSON.stringify(turf.featureCollection(features)), 'utf8')
//fs.writeFileSync('Farm_Population_NRW_kdbush_unfinished.geojson', JSON.stringify(turf.featureCollection(unfinished)), 'utf8')

const sample = cleanFarms.filter((f,i) => i%100 === 0).map(farm => {
  const matchingFarm = allFarms.find(f => f._index === farm.index)
  farm.plots = matchingFarm._plots
  farm.location = matchingFarm._location
  return farm
})
//console.log(totalHa);
//fs.writeFileSync('Farm_Population_NRW_sample_kdbush.json',JSON.stringify(sample),'utf8')
// .replace(/,/g,';').replace(/\./g,',')

function replaceUmlaute(str) {
  const umlautMap = {
    Ü: 'UE',
    Ä: 'AE',
    Ö: 'OE',
    ü: 'ue',
    ä: 'ae',
    ö: 'oe',
    ß: 'ss'
  };
  return str
    .replace(/[\u00dc|\u00c4|\u00d6][a-z]/g, a => {
      const big = umlautMap[a.slice(0, 1)];
      return big.charAt(0) + big.charAt(1).toLowerCase() + a.slice(1);
    })
    .replace(
      new RegExp('[' + Object.keys(umlautMap).join('|') + ']', "g"),
      a => umlautMap[a]
    );
}
