/**
 * Synthetic resin / thermoplastics market data (U.S., Mexico, Brazil — country level).
 * Produces: public/data/value.json, public/data/volume.json, public/data/segmentation_analysis.json
 */
const fs = require('fs');
const path = require('path');

const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

const ST_RESIN = 'By Resin/Thermoplastic Compound Types';
const ST_FORM = 'By Form';
const ST_TECH = 'By Technology';
const ST_DIST = 'By Distribution Channels';
const ST_END = 'End-Use Industries';

const ALL_GEO = ['U.S.', 'Mexico', 'Brazil'];

// Country-level market weights (normalized)
const geoWeights = {
  'U.S.': 0.45,
  Mexico: 0.3,
  Brazil: 0.25,
};
const wSum = Object.values(geoWeights).reduce((a, b) => a + b, 0);
for (const k of Object.keys(geoWeights)) geoWeights[k] /= wSum;

/**
 * Resin: top groups (shares of resin segment = 1) and optional nested children.
 * From spec: PE→MLDPE/LLDPE/HDPE/LDPE; PVC→PVC Resin, PVC Compound; other families as leaves.
 */
const RESIN_TOP = [
  {
    name: 'Polyethylene (PE)',
    share: 0.2,
    children: { MLDPE: 0.25, LLDPE: 0.25, HDPE: 0.3, LDPE: 0.2 },
  },
  { name: 'High Impact Polystyrene (HIPS)', share: 0.04, children: null },
  { name: 'General Purpose Polystyrene (GPPS)', share: 0.04, children: null },
  { name: 'Expanded Polystyrene (EPS)', share: 0.04, children: null },
  { name: 'Polypropylene (PP)', share: 0.16, children: null },
  {
    name: 'Polyvinyl Chloride (PVC)',
    share: 0.1,
    children: { 'PVC Resin': 0.55, 'PVC Compound': 0.45 },
  },
  { name: 'Acrylonitrile Butadiene Styrene (ABS)', share: 0.08, children: null },
  { name: 'Polycarbonate (PC)', share: 0.1, children: null },
  { name: 'Polycarbonate-ABS (PC-ABS)', share: 0.04, children: null },
  { name: 'Other Engineered Compounds', share: 0.2, children: null },
];

// Growth style multipliers per segment label (leaves and single-level families)
const resinSegmentGrowth = {
  MLDPE: 0.98,
  LLDPE: 1.0,
  HDPE: 0.99,
  LDPE: 0.97,
  'High Impact Polystyrene (HIPS)': 1.01,
  'General Purpose Polystyrene (GPPS)': 1.0,
  'Expanded Polystyrene (EPS)': 0.99,
  'Polyethylene (PE)': 0.99,
  'Polypropylene (PP)': 1.02,
  'Polyvinyl Chloride (PVC)': 0.96,
  'PVC Resin': 0.95,
  'PVC Compound': 1.0,
  'Acrylonitrile Butadiene Styrene (ABS)': 1.0,
  'Polycarbonate (PC)': 1.04,
  'Polycarbonate-ABS (PC-ABS)': 1.02,
  'Other Engineered Compounds': 1.08,
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

const distributionChannels = {
  'Direct Sales': 0.55,
  'Indirect (Distribution Channels, etc.)': 0.45,
};

const endUseMain = {
  Packaging: 0.22,
  Automotive: 0.24,
  Construction: 0.18,
  Electronics: 0.2,
  'Consumer Goods': 0.16,
};

const regionGrowth = 0.085;
const growthMult = {
  [ST_RESIN]: resinSegmentGrowth,
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
  [ST_DIST]: {
    'Direct Sales': 0.99,
    'Indirect (Distribution Channels, etc.)': 1.01,
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

const americas2021 = 22000;
const volumePerMillionUSD = 520;

function getResinGrowth(label) {
  const m = growthMult[ST_RESIN][label];
  return regionGrowth * (m != null ? m : 1) * (0.97 + seededRandom() * 0.06);
}

function buildResinNode(geoBase, topShare, node, roundFn) {
  if (!node.children) {
    const g = getResinGrowth(node.name);
    return generateTimeSeries(geoBase * topShare, g, roundFn);
  }
  const block = {};
  for (const [childName, cShare] of Object.entries(node.children)) {
    const g = getResinGrowth(childName);
    block[childName] = generateTimeSeries(geoBase * topShare * cShare, g, roundFn);
  }
  return block;
}

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
      [ST_DIST]: {},
      [ST_END]: {},
    };
    for (const node of RESIN_TOP) {
      out[geo][ST_RESIN][node.name] = buildResinNode(geoBase, node.share, node, roundFn);
    }
    for (const [f, sh] of Object.entries(forms)) {
      const gr = regionGrowth * growthMult[ST_FORM][f] * (0.98 + seededRandom() * 0.04);
      out[geo][ST_FORM][f] = generateTimeSeries(geoBase * sh, gr, roundFn);
    }
    for (const [t, sh] of Object.entries(technologies)) {
      const gr = regionGrowth * growthMult[ST_TECH][t] * (0.98 + seededRandom() * 0.05);
      out[geo][ST_TECH][t] = generateTimeSeries(geoBase * sh, gr, roundFn);
    }
    for (const [d, sh] of Object.entries(distributionChannels)) {
      const gr = regionGrowth * growthMult[ST_DIST][d] * (0.98 + seededRandom() * 0.04);
      out[geo][ST_DIST][d] = generateTimeSeries(geoBase * sh, gr, roundFn);
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
    [ST_DIST]: emptyNested(sample['U.S.'][ST_DIST]),
    [ST_END]: emptyNested(sample['U.S.'][ST_END]),
  };
  return {
    'U.S.': { ...fromSample },
    Mexico: { ...fromSample },
    Brazil: { ...fromSample },
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
console.log('Geographies:', Object.keys(valueData).join(', '));
console.log('Segment types in sample U.S.:', Object.keys(valueData['U.S.']));
