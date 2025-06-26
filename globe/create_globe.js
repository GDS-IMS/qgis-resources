/**
 * create_globe.js
 *
 * A CLI that produces SVG(s) of orthographic globes centered on 1 country.
 * Each highlighted country is filled in red; all others light gray (no borders).
 * The ocean is white, with graticules and a black circular outline.
 *
 * Usage:
 *   # Single country (default output is <ISO3>.svg)
 *   node create_globe.js --iso3 ETH --width 700 --height 600
 *
 *   # Override output filename
 *   node create_globe.js --iso3 USA --output mymap.svg
 *
 *   # All countries into a folder
 *   node create_globe.js --all --outdir maps --width 700 --height 700
 *
 *   # Show help
 *   node create_globe.js --help
 *
 * Defaults:
 *   iso3   = "ETH"
 *   width  = 800
 *   height = 800
 *   output = <iso3>.svg    (unless overridden)
 *   outdir = "."         (only used with --all)
 *
 * Dependencies (install via npm):
 *   d3 topojson-client jsdom
 */

const fs        = require("fs");
const path      = require("path");
const { JSDOM } = require("jsdom");
const d3        = require("d3");
const topojson  = require("topojson-client");

// ─── CLI ARGS & HELP ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

// Function to print usage/help and exit
function printHelp() {
  console.log(`Usage: node create_globe.js [options]

Options:
  --iso3, -i <code>    ISO3 code of the country to highlight (default: ETH)
  --width, -w <num>    Width of the output SVG (default: 800)
  --height <num>       Height of the output SVG (default: 800)
  --output, -o <file>  Output filename for single-country mode (default: <ISO3>.svg)
  --all                Generate one SVG per ISO3 code
  --outdir, -d <dir>   Directory for --all output (default: current directory)
  --help               Show this help message and exit
`);
  process.exit(0);
}

let countryToHighlight = "ETH";
let width  = 800;
let height = 800;
let output;
let outdir = null;
let all     = false;

for (let i = 0; i < argv.length; i++) {
  switch (argv[i]) {
    case "--help":
      printHelp();
      break;
    case "--iso3":
    case "-i":
      countryToHighlight = argv[++i] || countryToHighlight;
      break;
    case "--width":
    case "-w":
      width = parseInt(argv[++i], 10) || width;
      break;
    case "--height":
      height = parseInt(argv[++i], 10) || height;
      break;
    case "--output":
    case "-o":
      output = argv[++i] || output;
      break;
    case "--outdir":
    case "-d":
      outdir = argv[++i] || outdir;
      break;
    case "--all":
      all = true;
      break;
    default:
      console.warn(`⚠️  Unrecognized option: ${argv[i]}`);
  }
}

// Default output for single-country mode
if (!all && !output) {
  output = `${countryToHighlight}.svg`;
}

// ─── INPUT TOPOJSON ────────────────────────────────────────────────────────────
const inputTopoPath = "wrl_polbnd_int_25m_a_unhcr.json";
if (!fs.existsSync(inputTopoPath)) {
  console.error(`❌  TopoJSON not found: ${inputTopoPath}`);
  process.exit(1);
}

// ─── LOAD & PARSE TOPOJSON ─────────────────────────────────────────────────────
const topoRaw   = fs.readFileSync(inputTopoPath, "utf8");
const worldData = JSON.parse(topoRaw);

const topoKeys = Object.keys(worldData.objects || {});
if (topoKeys.length === 0) {
  console.error("❌  No topology objects found in the TopoJSON!");
  process.exit(1);
}
const topoKey = worldData.objects.countries ? "countries" : topoKeys[0];

// Extract GeoJSON features
const countries = topojson
  .feature(worldData, worldData.objects[topoKey])
  .features;

// Select only the features which have the propoerty "secondary_territory" = 0
const mainCountries = countries.filter(d => d.properties.secondary_territory === 0);

// ─── SVG GENERATOR ────────────────────────────────────────────────────────────
/**
 * Generate an SVG string for the given iso3 highlight.
 */
function generateSvg(iso3) {
  const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
  const document = dom.window.document;

  const projection = d3.geoOrthographic()
    .scale((Math.min(width, height) / 2) - 2)
    .translate([width / 2, height / 2])
    .clipAngle(90);
  const path = d3.geoPath().projection(projection);

  const target = countries.find(d => d.properties.iso3 === iso3);
  if (target) {
    const [lon, lat] = d3.geoCentroid(target);
    projection.rotate([-lon, -lat]);
  } else {
    console.warn(`⚠️  iso3 code not found: ${iso3}`);
  }

  const svg = d3.select(document.body)
    .append("svg")
      .attr("xmlns", "http://www.w3.org/2000/svg")
      .attr("width",  width)
      .attr("height", height);

  svg.append("path")
    .datum({ type: "Sphere" })
    .attr("d", path)
    .attr("fill", "white");

  svg.selectAll("path.country")
    .data(countries)
    .join("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("fill", d =>
        d.properties.iso3 === iso3 ? "#EF4A60" : "#D1CCCB"
      )
      .attr("stroke", d =>
        d.properties.iso3 === iso3 ? "#EF4A60" : "#D1CCCB"
      )
      .attr("stroke-width", 0.5)

      .attr("opacity", 1);

  const graticule = d3.geoGraticule().step([30, 30]);
  svg.append("path")
    .datum(graticule)
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-width", 1);

  return svg.node().outerHTML;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  if (all) {
    const dir = outdir || ".";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁  Created directory: ${dir}`);
    }
    for (const feat of mainCountries) {
      const iso = feat.properties.iso3;
      const filename = path.join(dir, `${iso}.svg`);
      const svgString = generateSvg(iso);
      fs.writeFileSync(filename, svgString);
      console.log(`✅  Written: ${filename}`);
    }
  } else {
    const svgString = generateSvg(countryToHighlight);
    fs.writeFileSync(output, svgString);
    console.log(`✅  Written: ${output}`);
  }
})();
