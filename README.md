# ktiwari.com

Personal site for **Dr. Kishan Tiwari** — planetary materials scientist, IIT Kharagpur.
Shock metamorphism, high-pressure mineralogy, meteorite petrology.

Static HTML. No build step, no framework, no npm install. Open `index.html` and it works.

## The idea

The page is a **depth column**. A fixed rail on the left runs 0 → 700 km, and every
section sits at the mantle depth its science actually corresponds to:

| Section | Depth | Why |
|---|---|---|
| Hero | 0 km | Surface |
| About | 35 km | Moho |
| Research | 410 km | olivine → wadsleyite |
| Publications | 660 km | ringwoodite → bridgmanite |
| Collaborators | 700 km | lower mantle |

The hero renders a procedural meteorite in WebGL — a noise-displaced icosahedron with a
ridged-noise shock-vein network burning through it. Scroll dollies the camera; the pointer
parallaxes it. It re-lights itself when the visitor flips the theme.

## Layout

```
index.html              the main page
calculations.html       three interactive calculators
assets/
  css/style.css         design tokens + all styling (light and dark)
  js/main.js            depth rail, reveals, theme switch, Bennu, meteor shower
  js/calc.js            the three models, charts, and Excel/CSV/PNG export
  img/*.webp            34 images, all from the original Google Site
CNAME                   custom domain for GitHub Pages
.nojekyll               stop Pages running Jekyll over the files
```

## The hero body

It is **101955 Bennu**, generated in code rather than loaded as a mesh: an oblate spinning-top
built from its published morphology — polar flattening, the equatorial ridge rotation piled up,
34 boulders, 16 shallow craters with raised rims, and two scales of regolith grain. The gold
filaments are ridged noise standing in for a shock-vein network. It re-lights itself when the
theme changes.

A separate 2D canvas runs a sparse **meteor shower** behind every section — each streak is one
body ablating, so it brightens to a flare and dies. Both respect `prefers-reduced-motion`.

## The calculators

| Tool | Model | Source |
|---|---|---|
| Shock-melt vein cooling | Exact slab-in-infinite-medium conduction solution | Carslaw & Jaeger (1959) §2.3 |
| Peak shock pressure | Linear Hugoniot `Us = C0 + S·up`, impedance match | Melosh (1989) ch. 4 |
| Crater scaling | π-group, gravity regime, competent rock | Schmidt & Housen (1987); Melosh §7.8 |

Each panel exports its full dataset as `.xlsx` (two sheets — data and the parameters that produced
it), `.csv` with a commented header, or the chart as `.png`. Everything runs client-side; nothing
is uploaded. Chart.js and SheetJS load from cdnjs.

To add a fourth calculator: copy a `<section class="strata calc">` block in `calculations.html`,
then add a `run…()` function in `assets/js/calc.js` that fills `results.<key>` with
`{name, file, ref, head, rows, meta}` — the export buttons pick it up automatically.

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

3. **Settings → Pages → Build and deployment → Deploy from a branch**, pick `main` and `/ (root)`.
4. For `www.ktiwari.com`: keep the `CNAME` file, then at your DNS host add a `CNAME`
   record pointing `www` at `<username>.github.io`. For the apex `ktiwari.com`, add
   four `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
   `185.199.111.153`. Tick **Enforce HTTPS** once the certificate is issued.

If you deploy to a *project* site (`username.github.io/repo`) rather than a custom domain,
delete `CNAME` — the relative asset paths already work either way.

## Editing

**Colours.** Everything comes from the tokens at the top of `style.css`. The light palette is
the bare `:root` block; the dark palette is redefined twice below it (once for the OS
preference, once for the explicit toggle). Change a token in all three and the whole page follows.

**Text.** All content is literal HTML in `index.html`. Search for the section heading and edit it.

**Photographs.** Drop a `.webp` (or `.jpg`) into `assets/img/` and point a
`<figure class="shot">` at it. Species captions in the photography section are guesses —
correct them.

**Publications.** Each is one `<a class="pub">` block in `#publications`. Copy the last one,
change the year, title, authors, journal and DOI.

## Credits

Type: Instrument Serif, Archivo, IBM Plex Mono (Google Fonts).
3D: three.js r128 from cdnjs.
Everything else is hand-written.

© Kishan Tiwari. Photographs and figures are his. Code is MIT (see `LICENSE`).
