const maxShares = {
  'Getreide': 1,
  'Hackfrüchte': 0.66,
  'Ackerfutter': 1,
  'Ölsaaten': 0.33,
  'Eiweißpflanzen': 0.25,
  'Dauerkulturen': 1,
  'Zierpflanzen': 1,
  'Gemüse': 1,
  'Energiepflanzen': 1
};

module.exports = class Farm {
  constructor (data,index) {
    this._index = index
    this._curArabLand = 0
    this._curGrasLand = 0
    this._distance = 0
    this._plots = []
    this._savedSize = JSON.parse(JSON.stringify(data.aspiredArableLand))
    
    Object.keys(data).forEach(prop => {
      this['_' + prop] = data[prop]
    })
    
    Object.keys(maxShares).forEach(crop => {
      this['_' + crop] = 0;
    });
  }
  get index () {
    return this._index
  }
  // crop getters
  get Getreide () {
    return this._Getreide
  }
  get Hackfrüchte () {
    return this._Hackfrüchte
  }
  get Ackerfutter () {
    return this._Ackerfutter
  }
  get Ölsaaten () {
    return this._Ölsaaten
  }
  get Eiweißpflanzen () {
    return this._Eiweißpflanzen
  }
  get Dauerkulturen () {
    return this._Dauerkulturen
  }
  get Zierpflanzen () {
    return this._Zierpflanzen
  }
  get Gemüse () {
    return this._Gemüse
  }
  get Energiepflanzen () {
    return this._Energiepflanzen
  }
  // crop setters
  set Getreide (area) {
    this._Getreide = area
  }
  set Hackfrüchte (area) {
    this._Hackfrüchte = area
  }
  set Ackerfutter (area) {
    this._Ackerfutter = area
  }
  set Ölsaaten (area) {
    this._Ölsaaten = area
  }
  set Eiweißpflanzen (area) {
    this._Eiweißpflanzen = area
  }
  set Dauerkulturen (area) {
    this._Dauerkulturen = area
  }
  set Zierpflanzen (area) {
    this._Zierpflanzen = area
  }
  set Gemüse (area) {
    this._Gemüse = area
  }
  set Energiepflanzen (area) {
    this._Energiepflanzen = area
  }
  
  get curArabLand () {
    return this._curArabLand
  }
  
  set curArabLand (area) {
    this._curArabLand = area
  }
  
  get curGrasLand () {
    return this._curGrasLand
  }
  
  set curGrasLand (area) {
    this._curGrasLand = area
  }
  
  get distance () {
    return this._distance
  }
  
  set distance (distance) {
    this._distance = distance
  }
  
  get location () {
    return this._location
  }
  
  get community () {
    return this._community
  }
  
  get aspiredArableLand() {
    return this._aspiredArableLand
  }
  
  get aspiredGrasLand() {
    return this._aspiredGrasLand
  }
  
  get aspiredFarmSize() {
    return this._aspiredFarmSize
  }
  
  get farmSizeUp () {
    return this._farmSizeUp
  }
  
  get farmSizeLo () {
    return this._farmSizeLo
  }
  get bwa () {
    return this._bwa
  }
  get bkr () {
    return this._bkr
  }
  set plots (plot) {
    this._plots.push(plot)
  }
  get plots () {
    return this._plots
  }
}