/**
 * Synthetic resin / thermoplastics market data for U.S. and Mexico (country level only, no sub-regions).
 * Produces: public/data/value.json, public/data/volume.json, public/data/segmentation_analysis.json
 */
const fs = require('fs');
const path = require('path');

const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

const ST_RESIN = 'By Resin/Thermoplastic Compound Types';
const ST_FORM = 'By Form';
const ST_TECH = 'By Technology';
const ST_END = 'End-Use Industries';

const ALL_GEO = ['U.S.', 'Mexico'];

// Country-level market weights (normalized)
const geoWeights = {
  'U.S.': 0.65,
  Mexico: 0.35,
};
const wSum = Object.values(geoWeights).reduce((a, b) => a + b, 0);
for (const k of Object.keys(geoWeights)) geoWeights[k] /= wSum;

const resins = {
  'Polyethylene (PE)': 0.14,
  'Polypropylene (PP)': 0.16,
  'Polyvinyl Chloride (PVC)': 0.1,
  'Polyethylene Terephthalate (PET)': 0.12,
  'Acrylonitrile Butadiene Styrene (ABS)': 0.08,
  'Polyamide (PA)': 0.07,
  'Polyphenylene Sulfide (PPS)': 0.04,
  'Polyoxymethylene (POM)': 0.04,
  'Polyether Ether Ketone (PEEK)': 0.03,
  'Polybutylene Terephthalate (PBT)': 0.05,
  'Polycarbonate (PC)': 0.08,
  'Polycarbonate-ABS (PC-ABS)': 0.04,
  'Other Engineered Compounds': 0.05,
};

const forms = { Liquid: 0.42, Solid: 0.58 };

const technologies = {
  'Injection Molding': 0.22,
  'Blow Molding': 0.1,
  Extrusion: 0.2,
  'Compression Molding': 0.06,
  'Rotational Molding': 0.05,
  Thermoforming: 0.12,
  '3D Printing': 0.08,
  'Foam Molding': 0.09,
  Others: 0.08,
};

// End-Use Industries: main categories only (no sub-segments in data or UI)
const endUseMain = {
  Packaging: 0.22,
  Automotive: 0.24,
  Construction: 0.18,
  Electronics: 0.2,
  'Consumer Goods': 0.16,
};

// CAGR-style multipliers per line (scaled relative to base regional growth)
const regionGrowth = 0.085;
const growthMult = {
  [ST_RESIN]: {
    'Polyethylene (PE)': 0.95,
    'Polypropylene (PP)': 1.02,
    'Polyvinyl Chloride (PVC)': 0.88,
    'Polyethylene Terephthalate (PET)': 0.98,
    'Acrylonitrile Butadiene Styrene (ABS)': 1.0,
    'Polyamide (PA)': 1.08,
    'Polyphenylene Sulfide (PPS)': 1.12,
    'Polyoxymethylene (POM)': 1.02,
    'Polyether Ether Ketone (PEEK)': 1.15,
    'Polybutylene Terephthalate (PBT)': 1.05,
    'Polycarbonate (PC)': 1.0,
    'Polycarbonate-ABS (PC-ABS)': 1.01,
    'Other Engineered Compounds': 1.1,
  },
  [ST_FORM]: { Liquid: 0.95, Solid: 1.04 },
  [ST_TECH]: {
    'Injection Molding': 1.0,
    'Blow Molding': 0.98,
    Extrusion: 1.05,
    'Compression Molding': 0.92,
    'Rotational Molding': 0.9,
    Thermoforming: 1.0,
    '3D Printing': 1.18,
    'Foam Molding': 0.95,
    Others: 0.94,
  },
  [ST_END]: {
    Packaging: 1.0,
    Automotive: 1.04,
    Construction: 0.98,
    Electronics: 1.1,
    'Consumer Goods': 0.99,
  },
};

let seed = 42;
function seededRandom() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function addNoise(value, noiseLevel = 0.03) {
  return value * (1 + (seededRandom() - 0.5) * 2 * noiseLevel);
}

function roundTo1(val) {
  return Math.round(val * 10) / 10;
}
function roundToInt(val) {
  return Math.round(val);
}

function generateTimeSeries(baseValue, growthRate, roundFn) {
  const series = {};
  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    const raw = baseValue * Math.pow(1 + growthRate, i);
    series[y] = roundFn(addNoise(raw));
  }
  return series;
}

// ~USD Million total market in 2021 at Americas level; split across U.S. and Mexico
const americas2021 = 18500;
const volumePerMillionUSD = 520;

function buildGeoData(isVolume) {
  const roundFn = isVolume ? roundToInt : roundTo1;
  const mult = isVolume ? volumePerMillionUSD : 1;
  const out = {};
  for (const geo of ALL_GEO) {
    const base = americas2021 * geoWeights[geo] * mult;
    const gVar = 1 + (seededRandom() - 0.5) * 0.04;
    const geoBase = base * gVar;
    out[geo] = {
      [ST_RESIN]: {},
      [ST_FORM]: {},
      [ST_TECH]: {},
      [ST_END]: {},
    };
    for (const [r, sh] of Object.entries(resins)) {
      const gr = regionGrowth * growthMult[ST_RESIN][r] * (0.97 + seededRandom() * 0.06);
      out[geo][ST_RESIN][r] = generateTimeSeries(geoBase * sh, gr, roundFn);
    }
    for (const [f, sh] of Object.entries(forms)) {
      const gr = regionGrowth * growthMult[ST_FORM][f] * (0.98 + seededRandom() * 0.04);
      out[geo][ST_FORM][f] = generateTimeSeries(geoBase * sh, gr, roundFn);
    }
    for (const [t, sh] of Object.entries(technologies)) {
      const gr = regionGrowth * growthMult[ST_TECH][t] * (0.98 + seededRandom() * 0.05);
      out[geo][ST_TECH][t] = generateTimeSeries(geoBase * sh, gr, roundFn);
    }
    for (const [ind, sh] of Object.entries(endUseMain)) {
      const gr = regionGrowth * growthMult[ST_END][ind] * (0.98 + seededRandom() * 0.04);
      out[geo][ST_END][ind] = generateTimeSeries(geoBase * sh, gr, roundFn);
    }
  }
  return out;
}

function emptyNested(obj) {
  if (obj === null || typeof obj !== 'object') return {};
  const keys = Object.keys(obj);
  if (keys.some((k) => /^\d{4}$/.test(k) || k === 'CAGR')) {
    return {};
  }
  const o = {};
  for (const k of keys) {
    o[k] = emptyNested(obj[k]);
  }
  return o;
}

function buildSegmentation() {
  const sample = buildGeoData(false);
  const fromSample = {
    [ST_RESIN]: emptyNested(sample['U.S.'][ST_RESIN]),
    [ST_FORM]: emptyNested(sample['U.S.'][ST_FORM]),
    [ST_TECH]: emptyNested(sample['U.S.'][ST_TECH]),
    [ST_END]: emptyNested(sample['U.S.'][ST_END]),
  };
  // Two top-level geographies, no "By Region" tree — flat geography picker (U.S. + Mexico only)
  return {
    'U.S.': { ...fromSample },
    Mexico: { ...fromSample },
  };
}

const outDir = path.join(__dirname, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

seed = 42;
const valueData = buildGeoData(false);
seed = 8001;
const volumeData = buildGeoData(true);
const seg = buildSegmentation();

fs.writeFileSync(path.join(outDir, 'value.json'), JSON.stringify(valueData, null, 2));
fs.writeFileSync(path.join(outDir, 'volume.json'), JSON.stringify(volumeData, null, 2));
fs.writeFileSync(path.join(outDir, 'segmentation_analysis.json'), JSON.stringify(seg, null, 2));

console.log('Wrote value.json, volume.json, segmentation_analysis.json');
console.log('Top-level geographies:', Object.keys(valueData).length, ALL_GEO.length === Object.keys(valueData).length ? '(U.S. + Mexico)' : '');
console.log('Sample geo keys:', Object.keys(valueData).slice(0, 3));
