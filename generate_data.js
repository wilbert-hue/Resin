/**
 * Synthetic resin / thermoplastics market data for U.S. and Mexico sub-regions.
 * Produces: public/data/value.json, public/data/volume.json, public/data/segmentation_analysis.json
 */
const fs = require('fs');
const path = require('path');

const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

const ST_RESIN = 'By Resin/Thermoplastic Compound Types';
const ST_FORM = 'By Form';
const ST_TECH = 'By Technology';
const ST_END = 'End-Use Industries';

const US_SUB = ['Northeast', 'Midwest', 'South', 'West', 'Southeast'];
const MX_SUB = [
  'Northern Mexico',
  'Central Mexico',
  'Western Mexico',
  'Southern Mexico',
  'Southeast Mexico',
];
const ALL_GEO = [...US_SUB, ...MX_SUB];

// Relative size of each sub-region (normalized before use)
const geoWeights = {
  Northeast: 0.12,
  Midwest: 0.1,
  South: 0.14,
  West: 0.11,
  Southeast: 0.13,
  'Northern Mexico': 0.05,
  'Central Mexico': 0.08,
  'Western Mexico': 0.04,
  'Southern Mexico': 0.05,
  'Southeast Mexico': 0.04,
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

const endUse = {
  Packaging: {
    'Flexible Packaging': 0.28,
    'Rigid Packaging': 0.25,
    'Food & Beverage Packaging': 0.3,
    'Others (Industrial Packaging, etc.)': 0.17,
  },
  Automotive: {
    'Exterior Components': 0.35,
    'Interior Components': 0.4,
    'Others (Under-the-Hood Components, etc.)': 0.25,
  },
  Construction: {
    'Building Materials': 0.38,
    'Flooring and Roofing': 0.32,
    'Others (Window Profiles and Doors, etc.)': 0.3,
  },
  Electronics: {
    'Consumer Electronics': 0.42,
    'Automotive Electronics': 0.33,
    'Others (Industrial Electronics, etc.)': 0.25,
  },
  'Consumer Goods': {
    'Household Appliances': 0.55,
    'Toys and Sporting Goods': 0.45,
  },
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

const endUseLeafMult = {
  'Flexible Packaging': 0.99,
  'Rigid Packaging': 1.0,
  'Food & Beverage Packaging': 1.01,
  'Others (Industrial Packaging, etc.)': 1.05,
  'Exterior Components': 1.0,
  'Interior Components': 1.01,
  'Others (Under-the-Hood Components, etc.)': 1.06,
  'Building Materials': 0.99,
  'Flooring and Roofing': 0.98,
  'Others (Window Profiles and Doors, etc.)': 1.0,
  'Consumer Electronics': 1.1,
  'Automotive Electronics': 1.08,
  'Others (Industrial Electronics, etc.)': 1.04,
  'Household Appliances': 0.98,
  'Toys and Sporting Goods': 1.0,
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

// ~USD Million total market in 2021 at “Americas” level; split across sub-regions
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
    for (const [ind, children] of Object.entries(endUse)) {
      out[geo][ST_END][ind] = {};
      const indGr = regionGrowth * growthMult[ST_END][ind] * (0.98 + seededRandom() * 0.04);
      for (const [leaf, sh] of Object.entries(children)) {
        const m = endUseLeafMult[leaf] || 1;
        out[geo][ST_END][ind][leaf] = generateTimeSeries(geoBase * sh * 0.2, indGr * m, roundFn);
      }
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
    [ST_RESIN]: emptyNested(sample[US_SUB[0]][ST_RESIN]),
    [ST_FORM]: emptyNested(sample[US_SUB[0]][ST_FORM]),
    [ST_TECH]: emptyNested(sample[US_SUB[0]][ST_TECH]),
    [ST_END]: emptyNested(sample[US_SUB[0]][ST_END]),
  };
  return {
    Global: {
      'By Region': {
        'U.S.': Object.fromEntries(US_SUB.map((s) => [s, {}])),
        Mexico: Object.fromEntries(MX_SUB.map((s) => [s, {}])),
      },
      ...fromSample,
    },
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
console.log('Top-level geographies:', Object.keys(valueData).length, ALL_GEO.length === Object.keys(valueData).length ? '(10 sub-regions)' : '');
console.log('Sample geo keys:', Object.keys(valueData).slice(0, 3));
