const d3 = require('d3')
const Farm_Population_NRW = require('./data/Farm_Population_NRW.json');
const bkrs = require('./data/bkrs_deutschland.json');
const fs = require('fs')
const turf = require('@turf/turf')
const util = require('util')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const community_polygons = require('./data/nuts3.json').features;

// We create a key-value store where each community is assigned to 
// a BKR, e.g.
// Preussisch-Oldendorf: 146,
// Preussisch-Stroen: 146
const community_to_bkr = community_polygons.reduce((obj,community) => {
  const bkrMatch = bkrs.features.find(bkr => turf.booleanPointInPolygon(turf.centroid(community),bkr))
  if (!bkrMatch) console.log(community.properties.GEN);
  obj[replaceUmlaute(community.properties.GEN)] = bkrMatch.properties.BKR10_ID
  return obj
},{})
;

let animalsLAU;

(async () => {
  // First, we load and re-arrange the data from W.B. and D.S structure data
  const sizeCluster = {
    below5: [0, 50],
    from5to10: [0, 50],
    from10to20: [0, 50],
    from20to50: [0, 50],
    from50to100: [50, 100],
    from100to200: [100, 200],
    above200: [200, 2000]
  };

  const farmTypeMatching = {
    Arable: 1,
    Dairy: 4,
    Pig: 5,
    Mixed: 8,
    MixedLivestock: 7,
    Fixed: 6
  };

  const animalFile = await readFile('Animals_AGS.csv', 'utf8')
  const animalData = d3.csvParse(animalFile)
  animalsLAU = animalData.reduce((obj,LAU) => {
    const gemeinde = community_polygons.find(f => f.properties.AGS == '0' + LAU.AGS)
    const gemeineName = replaceUmlaute(gemeinde.properties.GEN)
    obj[gemeineName] = {
      pigs: 0,
      pigsTarget: LAU.pigs,
      sows: 0,
      sowsTarget: LAU.sows,
      cows: 0,
      cowsTarget: LAU.cows
    }
    return obj
  },{})
  // parse the input GDX data, and create an array of farms with a given
  // size cluster, bwa category, and community
  const csvData = await readFile('farm_struct_2.csv', 'utf8')
  const rows = d3.csvParse(csvData.replace(/;/g, ','));
  // get a list of all communities that fall within the boundaries of the BKR 141
  const communities_names = community_polygons.map(f =>
    replaceUmlaute(f.properties.GEN)
  );
  // and for the number of farms of a category in the 
  // gdx from D.S and W.B, we create a new farm entry
  // in our allFarms array
  const allFarms = [];
  rows.forEach(r => {
    r.count = Number(r.count);
    for (let i = 0; i < r.count; i++) {
      allFarms.push({
        community: r.Gemeinde,
        bkr: community_to_bkr[r.Gemeinde],
        farmSizeLo: sizeCluster[r.sizeCluster][0],
        farmSizeUp: sizeCluster[r.sizeCluster][1],
        bwaCategory: farmTypeMatching[r.farmType]
      });
    }
  });
  // Right now, the farms in the array are sorted by communities
  // this way, the assignment of farms to communities would be biased, as the
  // communities in the end of the array are unlikely to be reached at all.
  // In order to circumvent this, we shuffle the array so that no specific
  // sorting order prevails
  const farmStructure = d3.shuffle(allFarms)
  
  // Find communities were no farms were assigned by W.B and D.S,
  // e.g. Vettweiss, Elsdorf, Velen, ...
  const notInFS = communities_names.filter(c => !farmStructure.some(fs => fs.community == c))
  console.log(notInFS);
  // const alreadyUsed = [];
  console.log(Farm_Population_NRW.length, farmStructure.length);
  // we go through each farm of the farm typology (Farm_Population_NRW, which we
  // again shuffle to ensure a random order) and try to find a matching
  // farm from D.S + W.B.'s dataset
  const farms_with_communities = d3.shuffle(Farm_Population_NRW).map((f, i) => {
    // make sure to find a matching farm that has the same BWA category,
    // as well as aspired farm size cluster
    const match = farmStructure.find(
      sf =>
      // alreadyUsed.indexOf(i) === -1 &&
      f.bkr == sf.bkr &&
      f.bwa > sf.bwaCategory * 100 &&
      f.bwa < (sf.bwaCategory + 1) * 100 &&
      f.aspiredFarmSize > sf.farmSizeLo &&
      f.aspiredFarmSize < sf.farmSizeUp &&
      !tooManyAnimals(f,sf)
    );
    
    if (!match) {
      f.community = 'No community found!';
    }
    else {
      const farmStructureIndex = farmStructure.indexOf(match)
      addAnimals(f,match)
      // alreadyUsed.push(farmStructure.indexOf(match));
      // if a match was found, we delete the matching farm from the 
      // farmStructure array in order to speed up the computation
      farmStructure.splice(farmStructureIndex, 1)
      f.community = match.community;
    }
    if (i % 1000 == 0) console.log('First round: ' + farmStructure.length);
    return f;
  });
  console.log('could not match',farms_with_communities.filter(f => f.community == 'No community found!').length, 'farms in first round');
  // in a second step, we try to assign farms that were not designated to a community yet
  // by removing the BWA constraint
  for (let i = 0; i < farms_with_communities.length; i++) {
    const f = farms_with_communities[i];
    if (f.community === 'No community found!') {
      const match = farmStructure.find(
        sf =>
        // alreadyUsed.indexOf(j) === -1 &&
        f.bkr == sf.bkr &&
        f.aspiredFarmSize > sf.farmSizeLo &&
        f.aspiredFarmSize < sf.farmSizeUp &&
        !tooManyAnimals(f,sf)
      );
      if (!match) {
        f.community = 'No community found!';
      }
      else {
        // alreadyUsed.push(farmStructure.indexOf(match));
        addAnimals(f,match)
        const farmStructureIndex = farmStructure.indexOf(match)
        farmStructure.splice(farmStructureIndex, 1)
        farms_with_communities[i].community = match.community;
      }
    }
    if (i % 1000 == 0) console.log('Second round: ' + farmStructure.length)
  }
  for (let i = 0; i < farms_with_communities.length; i++) {
    const f = farms_with_communities[i];
    if (f.community === 'No community found!') {
      const match = farmStructure.find(
        sf =>
        // alreadyUsed.indexOf(j) === -1 &&
        f.bkr == sf.bkr &&
        f.bwa > sf.bwaCategory * 100 &&
        f.bwa < (sf.bwaCategory + 1) * 100 &&
        !tooManyAnimals(f,sf)
      );
      if (!match) {
        f.community = 'No community found!';
      }
      else {
        // alreadyUsed.push(farmStructure.indexOf(match));
        addAnimals(f,match)
        const farmStructureIndex = farmStructure.indexOf(match)
        farmStructure.splice(farmStructureIndex, 1)
        farms_with_communities[i].community = match.community;
      }
    }
    if (i % 1000 == 0) console.log('Second round: ' + farmStructure.length)
  }
  for (let i = 0; i < farms_with_communities.length; i++) {
    const f = farms_with_communities[i];
    if (f.community === 'No community found!') {
      const match = farmStructure.find(
        sf =>
        // alreadyUsed.indexOf(j) === -1 &&
        f.bkr == sf.bkr &&
        !tooManyAnimals(f,sf)
      );
      if (!match) {
        f.community = 'No community found!';
      }
      else {
        // alreadyUsed.push(farmStructure.indexOf(match));
        addAnimals(f,match)
        const farmStructureIndex = farmStructure.indexOf(match)
        farmStructure.splice(farmStructureIndex, 1)
        farms_with_communities[i].community = match.community;
      }
    }
    if (i % 1000 == 0) console.log('Second round: ' + farmStructure.length)
  }
  await writeFile('not_assigned_from_fs.csv', d3.csvFormat(farmStructure), 'utf8')
  console.log('no community found for',farms_with_communities.filter(f => f.community == 'No community found!').length, 'farms')
  console.log(farmStructure.length);
  await writeFile('farms_with_communities.json', JSON.stringify(farms_with_communities), 'utf8')
})()

function tooManyAnimals(farm,sf) {
  const animals = ['pigs','sows','cows']
  return animals.some(animal => {
    if (!animalsLAU[sf.community]) {
      console.log(sf.community);
      return false
    }
    return farm[animal] && animalsLAU[sf.community][animal] + farm[animal] > animalsLAU[sf.community][animal + 'Target'] * 1.05
  })
}

function addAnimals(farm,sf) {
  const animals = ['pigs','sows','cows']
  return animals.forEach(animal => {
    if (animalsLAU[sf.community]) {
      animalsLAU[sf.community][animal] += farm[animal]
    } else {
      console.log(sf.community);
    }
  })
}

// this is a helper function to replace the umlauts
// which are frequently present in the gemeinde names
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