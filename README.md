# qgis-resources

This repo contains QGIS resources used at UNHCR.

## globe

A CLI tool to generate globes in SVG format highlighting 1 country.

These globes are used in the QGIS layout to locate the country of the map.

### Installation

First install Node.js and npm.


Clone the repo

```powershell
> git clone https://github.com/GDS-IMS/qgis-resources.git
```


Then install the modules required

```powershell
> cd globe

> npm install
```

### Dependencies

The tool needs the TopoJSON file `wrl_polbnd_int_25m_a_unhcr.json` (part of the repo). This is a GIS layer of countries used by UNHCR.

### Usage

```powershell
> node .\create_globe.js --help
Usage: node make_globe.js [options]

Options:
  --iso3, -i <code>    ISO3 code of the country to highlight (default: ETH)
  --width, -w <num>    Width of the output SVG (default: 800)
  --height <num>       Height of the output SVG (default: 800)
  --output, -o <file>  Output filename for single-country mode (default: <ISO3>.svg)
  --all                Generate one SVG per ISO3 code
  --outdir, -d <dir>   Directory for --all output (default: current directory)
  --help               Show this help message and exit

```

#### Create globe for 1 country

To create the globe of 1 particular country (here Ethiopia) use:

```powershell
globe> node .\create_globe.js --iso3 ETH
✅  Written: ETH.svg
```

You can also use the parameters `width`, `height` and `output`:

```powershell
globe> node .\create_globe.js --iso3 ITA --width 400 --height 400 --output my_folder/italy.svg
✅  Written: my_folder/italy.svg
```
Note that the folder mentioned `output` has to exist.

You can also highlight more than one country by passing a list of countries in the `--iso3` parameter:

```powershell
globe> node .\create_globe.js --iso3 CIV,GHA --output my_folder/CIV_GHA.svg
✅  Written: my_folder/CIV_GHA.svg
```

#### Create globes for all countries

You can also generate globes for all countries (1 file per country).

This will create 1 SVG file for each feature that has "secondary_territory" = 0 (meaning we don't consider the secondary territories).

Use the following syntax:

```
> node .\create_globe.js --all --outdir SVG
📁  Created directory: SVG
✅  Written: SVG\AFG.svg
✅  Written: SVG\AGO.svg
✅  Written: SVG\ALB.svg
...
✅  Written: SVG\USA.svg
✅  Written: SVG\ECU.svg
✅  Written: SVG\FIN.svg
```

Note that the folder mentioned in `outdir` doesn't need to exist, it will be created.

### GitHub Actions

The GitHub action `build-executable.yml` doesn't work.