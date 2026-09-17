# ktiwari.com

Personal site for **Dr. Kishan Tiwari**, planetary materials scientist, IIT Kharagpur.
Shock metamorphism, high-pressure mineralogy, meteorite petrology.

Static HTML. No build step, no framework, no `npm install`. Open `index.html` and it works.

## Layout

```
index.html              the site
calculations.html       three interactive calculators
404.html                not-found page, absolute asset paths
assets/
  css/site.css          every token and every rule, one file
  js/site.js            sky, Moon, depth meter, menu, scroll choreography
  js/calc.js            the three models, charts, Excel and CSV export
  js/moon-maps.js       the lunar map generator
  img/*.webp            34 photographs and figures
  img/og.jpg            1200x630 social card
v1/                     the earlier depth-rail design, kept for reference, noindex
CNAME .nojekyll robots.txt sitemap.xml
```

## The idea

The page is a descent. A meter in the corner counts from **0 km at the surface to 6,371 km at the
centre of the Earth**, and every section sits at the depth its science corresponds to: the Moho at
35, olivine to wadsleyite at 410, ringwoodite to bridgmanite at 660, the core to mantle boundary at
2,890. The number in the corner and the depth in the section heading are always the same number.

## What moves, and why

Four set pieces, all driven by GSAP ScrollTrigger:

1. **The hero assembles.** Three lines rise out of their own overflow, then the supporting material
   follows. It plays once, on load.
2. **A pinned five-step sequence.** The panel holds still while the reader descends through it, and
   the diagram builds: shock front, then veins drawn on stroke by stroke, then the high-pressure
   phases, then the quench.
3. **A horizontal rail of papers.** The section is exactly as tall as the sideways journey, so the
   pin never releases early and leaves a blank screen.
4. **A timeline that draws its own line** as the education entries arrive.

Behind all of it, a fixed canvas: stars that drift as you scroll, dust, and a sparse meteor shower
where each streak is one body ablating, so it brightens to a flare and dies.

**The Moon is generated in code**, not loaded as a mesh. `moon-maps.js` draws three equirectangular
maps at load: a height field of maria and craters with raised rims, an albedo map derived from it
and pulled down to the real lunar value of about 0.12, and a normal map taken from the height
gradient. One hard sun and almost no fill. It crosses the whole page on a four-waypoint path that
dips below the frame to change sides, so it never passes over the reading column.

## Behaviour on small screens

Pinning is wrapped in `gsap.matchMedia()` and only engages **above 880px**. On a phone, pinning a
full-height panel means scrolling four screens to read five short paragraphs, and iOS toolbars
resize the viewport mid-pin. Below 881px the sequence and the paper rail become ordinary stacked
sections, which is what the CSS already lays out. The depth meter stops being a floating pill and
docks as a slim strip along the bottom edge. Navigation collapses into a full-screen drawer.

There is also a rule for short landscape phones, where a pinned 100svh panel has nowhere to go.

## Editing

**Colours and type.** Tokens at the top of `site.css`. The site commits to one dark world on
purpose, so there is a single `:root` block, no theme switching.

**Text.** Literal HTML in `index.html`. Search for the heading and edit it.

**Depths.** Each section carries `data-depth` and `data-label`. The meter reads them directly, so
adding a section means adding those two attributes and nothing else.

**Photographs.** Drop a `.webp` into `assets/img/` and add a `<figure>` to the relevant grid. Give
it `width`, `height`, `alt` and `loading="lazy"`, the same as its neighbours.

**Publications.** Each is one `<a class="card">` in `#papers`. Copy the last one and change the
year, title, authors, journal and DOI. The rail measures itself, so nothing else needs adjusting.

**A fourth calculator.** Copy a `<section class="chapter calc">` block in `calculations.html`, then
add a `run…()` function in `calc.js` that fills `results.<key>` with
`{name, file, ref, head, rows, meta}`. The export buttons pick it up automatically.

## Publishing on GitHub Pages

1. Create a repo. For a user site use `<username>.github.io`; any name works for a project site.
2. Push everything in this folder to the default branch:

   ```bash
   git init
   git add .
   git commit -m "New personal site"
   git branch -M main
   git remote add origin git@github.com:<username>/<repo>.git
   git push -u origin main
   ```

3. **Settings, Pages, Build and deployment, Deploy from a branch**, pick `main` and `/ (root)`.
4. For `www.ktiwari.com`: keep the `CNAME` file, then at your DNS host add a `CNAME` record
   pointing `www` at `<username>.github.io`. For the apex `ktiwari.com`, add four `A` records to
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Tick **Enforce
   HTTPS** once the certificate is issued.

Asset paths are absolute (`/assets/...`), so this must deploy at a domain root. If you deploy to a
project path like `username.github.io/repo`, delete `CNAME` and change the leading `/assets` to
`assets` throughout, or the CSS will not load.

## Checked before handover

`PRE-DEPLOY-REPORT.md` records the full run against `PRE-DEPLOY-CHECKLIST.md`. Short version: no
horizontal scroll at any of eight widths from 1440 down to 360, zero console errors, alt text on
all 35 images, a visible focus ring on every one of 49 focusable elements, every colour at WCAG AA
against its real background, and all three pages fully readable with JavaScript off.

## Credits

Type: Bodoni Moda, Manrope, JetBrains Mono, from Google Fonts.
Libraries: three.js r128, GSAP 3.12.5 with ScrollTrigger, Chart.js 4.4.1, SheetJS 0.18.5, all from
cdnjs. Everything else is hand-written.

© Kishan Tiwari. Photographs, figures and the KT monogram are his and are not licensed for reuse.
Code is MIT, see `LICENSE`.
