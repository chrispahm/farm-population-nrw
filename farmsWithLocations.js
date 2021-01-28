const farms_with_communities = require('./farms_with_communities.json')
const fs = require('fs')
const turf = require('@turf/turf')
const d3 = { ...require("d3"),
  ...require("d3-random")
}
const util = require('util')
const plots_nrw_sqr = require('../data/all_plots_nrw_unsimplified.json')
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const community_polygons = require('../data/nuts3.json').features;


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


const plots_in_communities = community_polygons.reduce((obj, community, i) => {
  if (i%10 == 0) console.log(i,community_polygons.length)
  obj[replaceUmlaute(community.properties.GEN)] = {
    arablePlots: plots_nrw_sqr.features.filter(f => {
      try {
        const flag = f.properties.D_USE !== 'Dauergrünland' &&
        turf.booleanPointInPolygon(turf.centroid(f), community)
        return flag
      } catch (e) {
        if (!f.geometry) return
        return f.properties.D_USE !== 'Dauergrünland'
      }      
    }),
    grasslandPlots: plots_nrw_sqr.features.filter(f => {
      try {
        const flag = f.properties.D_USE === 'Dauergrünland' &&
        turf.booleanPointInPolygon(turf.centroid(f), community)
        return flag
      } catch (e) {
        if (!f.geometry) return
        return f.properties.D_USE === 'Dauergrünland'
      }
    })
  };
  
  if (!obj[replaceUmlaute(community.properties.GEN)].arablePlots.length) {
    console.log('No arable plots in', community.properties.GEN);
  }
  if (!obj[replaceUmlaute(community.properties.GEN)].grasslandPlots.length) {
    console.log('No grassland plots in', community.properties.GEN);
  }
  return obj;
}, {});

writeFile('plots_in_communities.json', JSON.stringify(plots_in_communities), 'utf8').then(() => {
  console.log('done');
})
*/
const usedLocations = []

//console.log(plots_in_communities.Roetgen.arablePlots.length,plots_in_communities.Roetgen.grasslandPlots.length);

function createRandomFarmLocation(farm, count = 0) {
  // determine if farm has more than 50% grassland
  let plots = plots_in_communities[farm.community].arablePlots;
  if (farm.aspiredGrasLand / farm.aspiredArableLand > 0.5 || count > 3)
    plots = plots_in_communities[farm.community].grasslandPlots;
  // create a random integer between 0 and the number of plots in the dataset
  const randomInteger = d3.randomInt(plots.length)();
  const randomPlot = plots[randomInteger];
  // convert the plot into a feature collection of points (coordinates of the polygon)
  let fcOfPoints = turf.explode(randomPlot);
  if (!fcOfPoints.features.length) {
    if (plots[randomInteger - 1]) {
      fcOfPoints = turf.explode(plots[randomInteger -1])
    }
    if (!fcOfPoints.features.length && plots[randomInteger + 1]) {
      fcOfPoints = turf.explode(plots[randomInteger +1])
    }
    if (!fcOfPoints.features.length && count < 4) {
      return createRandomFarmLocation(farm, count + 1)
    }
  }
  // create a random integer between 0 and the number of points (coordinates) in the polygon
  const randomIntegerPoint = d3.randomInt(0, fcOfPoints.features.length)();
  const location = fcOfPoints.features[randomIntegerPoint];
  if (usedLocations.indexOf(location) > -1 && count < 4) {
    return createRandomFarmLocation(farm, count + 1)
  } 
  return location
}

const farmsWithLocations = farms_with_communities
  .filter(f => f.community !== 'No community found!')
  .map((farm,i) => {
    farm.location = createRandomFarmLocation(farm);
    if (!farm.location) console.log(i, farm.community);
    else usedLocations.push(farm.location)
    return farm;
});

writeFile('farms_with_locations.json', JSON.stringify(farmsWithLocations), 'utf8').then(() => {
  console.log('done');
})
