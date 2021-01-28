# Generating a synthetic farm population for North-Rhine Westphalia, Germany
This repository contains the code for generating a synthetic farm population for North-Rhine Westphalia

## Prerequsites

1) For the entire analysis, [Node.js](https://nodejs.org/en/) is required to be installed
on your computer and assumed to be in your path variable.
2) We recommend a computer with >= 16gb of RAM, and a minimum of 10GB free disk space. Lower amounts of 
RAM may work as well, but have not been tested yet.
3) While they are required for the analysis, the plot geometries in NRW are not included in this versioning repository (due to size restrictions). They can be obtained from the [OpenGeodata.NRW](https://www.opengeodata.nrw.de/produkte/umwelt_klima/bodennutzung/landwirtschaft/) portal, and need to be converted into the `GeoJSON` format. We recommend the free and open source service
[Mapshaper](https://mapshaper.org) for this task. Make sure to rename the the `GeoJSON` file to "all_plots_nrw_unsimplified.json", and move it into the `data` directory of this repository

## Execution order

1) Execute `node --max-old-space-size=8192 farms_to_communities.js`
2) Execute `node --max-old-space-size=8192 farmsWithLocations.js`
3) Execute `node --max-old-space-size=8192 plotAssignment.js`
4) Execute `node --max-old-space-size=8192 data_to_geojson.js`