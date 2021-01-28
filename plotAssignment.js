// go go go!
const start = new Date()
const fs = require('fs')
const turf = require('@turf/turf')
const d3 = { ...require("d3"),
  ...require("d3-random")
}
const kdbush = require('kdbush');
const geokdbush = require('geokdbush');

const farmsWithLocations = require('./farms_with_locations.json')
const allPlotsNRW = require('../data/all_plots_nrw_unsimplified.json')
const aspiredArab = d3.sum(farmsWithLocations.map(f => f.aspiredArableLand))
const aspiredGrass = d3.sum(farmsWithLocations.map(f => f.aspiredGrasLand))
console.log(aspiredArab,aspiredGrass,d3.sum(allPlotsNRW.features.map(p => p.properties.MEA_HA)));

const maxShares = {
  'Getreide': 0.75,
  'Hackfrüchte': 0.5,
  'Ackerfutter': 0.75,
  'Ölsaaten': 0.33,
  'Eiweißpflanzen': 0.25,
  'Dauerkulturen': 1,
  'Zierpflanzen': 1,
  'Gemüse': 1,
  'Energiepflanzen': 1
};

const Farm = require('./Farm.js')

allFarms = farmsWithLocations.map((f,i) => {
  return new Farm(f,i)
})

const index = new kdbush(allFarms.map((f, i) => {
  return {
    lon: f.location.geometry.coordinates[0],
    lat: f.location.geometry.coordinates[1],
    index: i
  }
}), (p) => p.lon, (p) => p.lat);


const community_polygons = require('../data/nrw_lau.json').features;
const communitySpatialIndex = new kdbush(community_polygons.map((f, i) => {
  f.properties.centroid = turf.centroid(f)
  return f
}), (p) => p.properties.centroid.geometry.coordinates[0], (p) => p.properties.centroid.geometry.coordinates[1]);


const orders = {
  Getreide: [151, 162],
  Hackfrüchte: [161, 162],
  Ölfrüchte: [162],
  Ackerfutter: [450, 460, 470, 731, 732, 832]
}

const unusedArable = []
const unusedGrass = []

// we shuffle the plots so we don't assign plots sorted by communities
const shuffled = d3.shuffle(allPlotsNRW.features)
// first round, we go through each community and assign each plot to a farm
for (let i = 0; i < shuffled.length; i++) {
  const plot = shuffled[i]
  const plotIndex = i

  if (plotIndex%10000 === 0) console.log(
    'finished',plotIndex,
    'plots,',
    unusedArable.length,
    unusedGrass.length,
    shuffled.length
  )

  try {
    const length = turf.getCoords(plot.geometry).length
    if (!length) continue
  } catch (e) {
    // plot without geometry or coordinates... disregard
    continue
  }
  
  const centroid = turf.centroid(plot)
  
  const sortedCommunities = geokdbush.around(communitySpatialIndex, 
    centroid.geometry.coordinates[0], centroid.geometry.coordinates[1])
  try {
    plot.properties.community = replaceUmlaute(
      sortedCommunities.find(com => turf.booleanPointInPolygon(centroid,com)).properties.GN
    )
  } catch (e) {
    // no community found for the given plot, skip
    continue
  }
  const cropGroup = plot.properties.D_USE;
  // disregard both Dauerkulturen and Gemüse for now
  if (cropGroup == 'Dauerkulturen' || cropGroup == 'Gemüse') continue
  
  const maxShareCrop = maxShares[cropGroup] || 1;
  const plotSize = plot.properties.MEA_HA;
  
  if (cropGroup === 'Dauergrünland') {
    const farmsInRange = geokdbush.around(index, centroid.geometry.coordinates[0], centroid.geometry.coordinates[1], Infinity, 21.21)
    const farms = farmsInRange.map(f => allFarms[f.index])
    let match = farms.find(f => {
      if (!f) return
      return f.curGrasLand + plotSize < f.aspiredGrasLand && f.curArabLand + plotSize + f.curGrasLand < f.farmSizeUp;
    });

    if (match) {
      match.curGrasLand = match.curGrasLand + plotSize;
      plot.properties.farmId = `${match.bwa}_${match.bkr}_${match.community}_${Math.round(match.aspiredArableLand)}_${Math.round(match.aspiredGrasLand)}`;
      // plot.properties.distance = match.distance;
      plot.properties.farmLocation = match.location.geometry.coordinates;
      match.plots = plot
    } else {
      unusedGrass.push(plot)
    }
  } else {
    // this code runs for all arable cultures
    // and sort depending on the plot cultivation, bwa, and driving distance
    // top priority is bwa, second priority is distance
    let farmsInRange = geokdbush.around(index, centroid.geometry.coordinates[0], centroid.geometry.coordinates[1], Infinity, 5)
    let farms = farmsInRange.map(f => allFarms[f.index])

    farms = farmsInRange
      .sort((a, b) => {
        let bwaIndex = 0;
        if (orders[cropGroup]) {
          // if a BWAs that need the culture are defined, place them before farms
          // of other BWAs
          let bwaIndexA = orders[cropGroup].indexOf(a.bwa) > -1 ? -1 : 0;
          let bwaIndexB = orders[cropGroup].indexOf(b.bwa) > -1 ? -1 : 0;
          bwaIndex = bwaIndexA - bwaIndexB;
        }
        // and subsequently sort by distances
        return bwaIndex === 0 ? a.distance - b.distance : bwaIndex;
      });

    let match = farms.find(f => {
      if (!f) return
      let fitsCriteria = false;
      // check if the plot would still fit to the aspired farm land range
      fitsCriteria = f.curArabLand + plotSize < f.aspiredArableLand && f.curArabLand + plotSize + f.curGrasLand < f.farmSizeUp;
      if (!fitsCriteria) return false;
      // also make sure the maximum crop shares are not exceeded,
      // but only when the farm is required to follow the Greening obligations
      if (f.aspiredArableLand > 10 && f.plots.length) {
        fitsCriteria =
          f[cropGroup] + plotSize < f.aspiredArableLand * maxShareCrop;
        if (!fitsCriteria) return false;
      }
      return fitsCriteria;
    });
    if (match) {
      match.curArabLand = match.curArabLand + plotSize;
      match[cropGroup] = match[cropGroup] + plotSize;
      plot.properties.farmId = `${match.bwa}_${match.bkr}_${match.community}_${Math.round(match.aspiredArableLand)}_${Math.round(match.aspiredGrasLand)}`;
      // plot.properties.distance = match.distance;
      plot.properties.farmLocation = match.location.geometry.coordinates;
      match.plots = plot
      continue
    }
    // second round
    farmsInRange = geokdbush.around(index, centroid.geometry.coordinates[0], centroid.geometry.coordinates[1], Infinity, 21.21)
    farms = farmsInRange.map(f => allFarms[f.index])
    if (!farms || !farms.length) {
      unusedArable.push(plot);
      continue
    }
    match = farms.find(f => {
      if (!f) return
      let fitsCriteria = false;
      // check if the plot would still fit to the aspired farmland range
      fitsCriteria = f.curArabLand + plotSize < f.aspiredArableLand && f.curArabLand + plotSize + f.curGrasLand < f.farmSizeUp;
      if (!fitsCriteria) return false;
      // also make sure the maximum crop shares are not exceeded,
      // but only when the farm is required to follow the Greening obligations
      if (f.aspiredArableLand > 10 && f.plots.length) {
        fitsCriteria =
          f[cropGroup] + plotSize < f.aspiredArableLand * maxShareCrop;
        if (!fitsCriteria) return false;
      }
      return fitsCriteria;
    });
    if (match) {
      match.curArabLand = match.curArabLand + plotSize;
      match[cropGroup] = match[cropGroup] + plotSize;
      plot.properties.farmId = `${match.bwa}_${match.bkr}_${match.community}_${Math.round(match.aspiredArableLand)}_${Math.round(match.aspiredGrasLand)}`;
      // plot.properties.distance = match.distance;
      plot.properties.farmLocation = match.location.geometry.coordinates;
      match.plots = plot
    } else {
      unusedArable.push(plot);
    }
  }
}


const unusedPlots = [...unusedGrass,...unusedArable]
const stillUnused = []
const unfinishedFarmsFirstRound = allFarms.filter(f => f.curArabLand + f.curGrasLand < f.aspiredFarmSize * 0.95)

console.log('Finished', (allFarms.length - unfinishedFarmsFirstRound.length)/allFarms.length*100, '% of farms in first round');
console.log('Now starting second round...');
// now we go through all unused plots again, and add them to the closest farm
// that is not finished yet
if (unfinishedFarmsFirstRound.length) {
  const secondIndex = new kdbush(unfinishedFarmsFirstRound.map((f, i) => {
    return {
      lon: f.location.geometry.coordinates[0],
      lat: f.location.geometry.coordinates[1],
      index: i
    }
  }), (p) => p.lon, (p) => p.lat);
  
  for (let i = 0; i < unusedPlots.length; i++) {
    const plot = unusedPlots[i]
    const plotIndex = i

    if (plotIndex%10000 == 0) console.log(
      'finished',plotIndex,
      'out of:',
      unusedPlots.length
    )

    const plotSize = plot.properties.MEA_HA;
    const cropGroup = plot.properties.D_USE;
    
    // calculate the driving distances from the plot to the farms
    const centroid = turf.centroid(plot)
    const farmsInRange = geokdbush.around(secondIndex, centroid.geometry.coordinates[0], centroid.geometry.coordinates[1], Infinity, 21.21)
    const farms = farmsInRange.map(f => unfinishedFarmsFirstRound[f.index])
    
    let match = farms.find(f => {
      if (!f) return
      return f.curArabLand + plotSize + f.curGrasLand < f.aspiredFarmSize;
    });
    if (match) {
      if (cropGroup == 'Dauergrünland') {
        match.curGrasLand = match.curGrasLand + plotSize;
      } else {
        match.curArabLand = match.curArabLand + plotSize;
        match[cropGroup] = match[cropGroup] + plotSize;
      }
      plot.properties.farmId = `${match.bwa}_${match.bkr}_${match.community}_${Math.round(match.aspiredArableLand)}_${Math.round(match.aspiredGrasLand)}`;
      // plot.properties.distance = match.distance;
      plot.properties.farmLocation = match.location.geometry.coordinates;
      match.plots = plot
    } else {
      stillUnused.push(plot);
    }
  }
}

fs.writeFileSync('Farm_Population_NRW_assigned_plots_kdbush.json',JSON.stringify(allFarms),'utf8')
fs.writeFileSync('unusedPlots.json',JSON.stringify(turf.featureCollection(stillUnused)),'utf8')

// first round is finished! now we take out all farms, that have already met their size criterion
let unfinishedFarms = allFarms.filter(f => f.curArabLand + f.curGrasLand < f.aspiredFarmSize * 0.95)
console.log('Finished', (allFarms.length - unfinishedFarms.length)/allFarms.length*100, '% of farms in second round');
console.log(unfinishedFarms.length,'farms unfinished');
console.log('not assigend', stillUnused.length, 'plots, ', d3.sum(stillUnused.map(p => p.properties.MEA_HA)), 'ha');

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

const end = new Date()
console.log('took',(end - start) / (1000 * 60), 'minutes');