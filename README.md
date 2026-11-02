# VTS Hub: Vegetated Treatment Systems (prototype)

Open materials for operating and maintaining vegetated treatment systems (VTS) in the Salinas Valley, California: sediment basins (SB), treatment wetlands (TW), vegetated ditches (VD), and woodchip bioreactors (WB).

**Status: draft prototype.** The manual content is not yet validated by the technical reviewer. Map statuses are demo data. Everything in this repository is public.

## What is here
| Folder | What it is |
|---|---|
| `docs/` | The web prototype (static site). Open `docs/index.html`, or publish it with GitHub Pages. |
| `tools/manual_builder/` | Notebook that builds the manual (PDF), checklists, forms, and diagrams from one Excel file. |
| `tools/plant_catalogue_builder/` | Notebook that builds the Plant Catalogue (VTS_D02) from one Excel file. |
| `tools/build_site_data.py` | Script that turns the two Excel files into the data the web prototype reads. |
| `data/geo/` | Site locations and watershed layers (GeoJSON) taken from the project's GIS file. |
| `review/` | Content review and its status. |

## Publish the site
Settings → Pages → Build and deployment → Source: *Deploy from a branch* → Branch: `main`, folder: `/docs` → Save. The address appears on that page after a minute or two.

## Edit the content
1. Edit the Excel file in `tools/manual_builder/data/` (manual) or `tools/plant_catalogue_builder/data/` (plants).
2. Run the notebook in the same folder to rebuild the PDFs and Excel forms.
3. Run `tools/build_site_data.py` to refresh the web prototype.

## Sources and licenses
Each plant card and task lists its sources. Licenses for code and content are not set yet.
