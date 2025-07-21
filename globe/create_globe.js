#!/usr/bin/env node

/**
 * create_globe.js
 *
 * A CLI that produces an SVG of an orthographic globe centered on specified country(ies).
 * Highlighted country(ies) are filled in red; others light gray (no borders).
 * The ocean is white, with graticules and a black circular outline.
 *
 * Usage:
 *   # Single or multiple countries (comma-separated), single SVG output
 *   node create_globe.js --iso3 ETH            # outputs ETH.svg
 *   node create_globe.js --iso3 ETH,USA,BRA    # outputs ETH,USA,BRA.svg or specified output
 *
 *   # Override output filename
 *   node create_globe.js --iso3 USA --output mymap.svg
 *
 *   # All countries into a folder (one SVG per ISO3)
 *   node create_globe.js --all --outdir maps
 *
 *   # Show help
 *   node create_globe.js --help
 *
 * Defaults:
 *   iso3   = "ETH"
 *   width  = 800
 *   height = 800
 *   output = <ISO3>.svg    (unless overridden)
 *   outdir = "."          (only used with --all)
 *
 * Dependencies (install via npm):
 *   d3 topojson-client jsdom
 */

const fs        = require('fs');
const path      = require('path');
const { JSDOM } = require('jsdom');
const { geoOrthographic, geoPath, geoGraticule, geoBounds } = require('d3-geo');
const { select } = require('d3-selection');
const topojson  = require('topojson-client');

// ─── CLI ARGS & HELP ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

function printHelp() {
  console.log(`Usage: node create_globe.js [options]

Options:
  --iso3, -i <codes>   ISO3 code(s), comma-separated (default: ETH)
  --width, -w <num>    Width of the SVG (default: 800)
  --height <num>       Height of the SVG (default: 800)
  --output, -o <file>  Output filename for single/multiple iso3 (default: <ISO3>.svg)
  --all                Generate one SVG per ISO3 into --outdir
  --outdir, -d <dir>   Directory for --all output (default: current directory)
  --help               Show help
`);
  process.exit(0);
}

let iso3List = ['ETH'];
let width     = 800;
let height    = 800;
let output;
let outdir    = null;
let all       = false;

for (let i = 0; i < argv.length; i++) {
  switch (argv[i]) {
    case '--help':
      printHelp();
      break;
    case '--iso3':
    case '-i':
      iso3List = (argv[++i] || iso3List.join(',')).split(',').map(s => s.trim().toUpperCase());
      break;
    case '--width':
    case '-w':
      width = parseInt(argv[++i], 10) || width;
      break;
    case '--height':
      height = parseInt(argv[++i], 10) || height;
      break;
    case '--output':
    case '-o':
      output = argv[++i] || output;
      break;
    case '--outdir':
    case '-d':
      outdir = argv[++i] || outdir;
      break;
    case '--all':
      all = true;
      break;
    default:
      console.warn(`⚠️  Unrecognized option: ${argv[i]}`);
  }
}

// Default output file when not --all
if (!all) {
  if (!output) {
    // join list for filename
    output = `${iso3List.join(',')}.svg`;
  }
}

// ─── INPUT TOPOJSON ────────────────────────────────────────────────────────────
const inputTopoPath = 'wrl_polbnd_int_25m_a_unhcr.json';
if (!fs.existsSync(inputTopoPath)) {
  console.error(`❌  TopoJSON not found: ${inputTopoPath}`);
  process.exit(1);
}

// ─── LOAD & PARSE TOPOJSON ─────────────────────────────────────────────────────
const topoRaw   = fs.readFileSync(inputTopoPath, 'utf8');
const worldData = JSON.parse(topoRaw);
const topoKeys  = Object.keys(worldData.objects || {});
if (topoKeys.length === 0) {
  console.error('❌  No topology objects found in the TopoJSON!');
  process.exit(1);
}
const topoKey = worldData.objects.countries ? 'countries' : topoKeys[0];

// Extract features and filter main countries
const countries     = topojson.feature(worldData, worldData.objects[topoKey]).features;
const mainCountries = countries.filter(d => d.properties.secondary_territory === 0);

// ─── SVG GENERATOR ────────────────────────────────────────────────────────────
/**
 * Generate SVG markup highlighting specified iso3 codes.
 */
function generateSvg(highlightIso3) {
  // highlightIso3: array of codes
  const dom       = new JSDOM(`<!DOCTYPE html><body></body>`);
  const document  = dom.window.document;
  const projection = geoOrthographic()
    .scale((Math.min(width, height) / 2) - 2)
    .translate([width / 2, height / 2])
    .clipAngle(90);
  const path = geoPath().projection(projection);

  // center on bounding box center of all highlights
  const selected = countries.filter(d => highlightIso3.includes(d.properties.iso3));
  if (selected.length) {
    const bounds = geoBounds({ type: 'FeatureCollection', features: selected });
    const [[minLon, minLat], [maxLon, maxLat]] = bounds;
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    projection.rotate([-centerLon, -centerLat]);
  }


  const svg = select(document.body)
    .append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width',  width)
      .attr('height', height);

  // ocean
  svg.append('path')
    .datum({ type: 'Sphere' })
    .attr('d', path)
    .attr('fill', 'white');

  // countries
  svg.selectAll('path.country')
    .data(countries)
    .join('path')
      .attr('class', 'country')
      .attr('d', path)
      .attr('fill', d =>
        highlightIso3.includes(d.properties.iso3)
          ? '#EF4A60'
          : '#D1CCCB'
      )
      .attr("stroke", d =>
        highlightIso3.includes(d.properties.iso3) ? "#EF4A60" : "#D1CCCB"
      )
      .attr("stroke-width", 0.5)
      .attr('opacity', 1);

  // graticule
  const graticule = geoGraticule().step([30, 30]);
  svg.append('path')
    .datum(graticule)
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', 'white')
    .attr('stroke-width', 1);

  return svg.node().outerHTML;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  if (all) {
    // one per country
    const dir = outdir || '.';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    for (const feat of mainCountries) {
      const iso = feat.properties.iso3;
      const filename = path.join(dir, `${iso}.svg`);
      fs.writeFileSync(filename, generateSvg([iso]));
      console.log(`✅  Written: ${filename}`);
    }
  } else {
    // single SVG highlighting list
    fs.writeFileSync(output, generateSvg(iso3List));
    console.log(`✅  Written: ${output}`);
  }
})();
