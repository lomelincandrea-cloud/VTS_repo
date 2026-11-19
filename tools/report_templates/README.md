# Report templates

Two printable reports made from the records of one VTS. They only **extract** what the Visit Sheet (F04), the Site History (F06), the Corrective Maintenance Log (F05) and the Annual Plan (F03) already hold. Anything not recorded prints "No data recorded".

| Report | What it is for | Who reads it |
|---|---|---|
| **Food Safety Record** (`food_safety_record.html`) | Shows, visit by visit, that the system is maintained and that findings are acted on: vegetation, wildlife (only if the project owner chooses), farm activity, structures, water, trash, corrective work, photos, sign-off. Optional appendix with the change history. | The project owner and their food safety auditors. It is documentation they can show an auditor; the auditor or the program decides what it needs. |
| **Water Quality and Maintenance Summary** (`water_summary.html`) | Shows the indicators of the Monitoring framework (TOP-07.S05) with targets, results, methods and trends, and justifies the maintenance done. No exact location; no project owner unless they choose. | Preservation, Inc., the Water Boards, and the workforce. |

Both say the period covered, the date generated, and "Generated from the Visit Sheets, Site History and Corrective Log of this site."
The names are neutral and may change.

## Files

| File | What |
|---|---|
| `data_schema.json` | The records the reports read (storage-agnostic, JSON Schema). Same model the Tool will use (COWORK Part 4). |
| `indicators.json` | The indicators, built from the Monitoring framework table (TOP-07.S05) of the manual. Do not edit by hand. |
| `build_indicators.py` | Rebuilds `indicators.json` from the manual workbook. IDs stay stable when rows are added. |
| `sample_data.json` | Made-up records for one VTS of each type. `meta.sample = true`, so every page says "Sample data". |
| `report_model.py` | All the rules: nitrate units and evidence levels, strip ranges, same-method comparisons, targets, charts. The templates only print. |
| `food_safety_record.html`, `water_summary.html`, `_style.html` | Templates (Jinja syntax that Nunjucks can also read, so the Tool can use the same files in the browser). A4, the manual's palette and fonts. |
| `render_reports.py` | Renders HTML and PDF for each site and runs the checks. |
| `report_coverage.md` | Every field in both reports, its source, and whether it is captured. |

## Render

From this folder, with the conda environment `vts` (it has WeasyPrint, Jinja2 and pdftotext):

```
python build_indicators.py                 # only after the Monitoring framework changes in the manual
python render_reports.py                   # all sites in sample_data.json, both reports
python render_reports.py --site S-TW --history   # one site, Food Safety Record with the change history appendix
```

On Windows, run the environment's Python directly and put its `Library\bin` on the PATH so `pdftotext` is found, for example in PowerShell:
`$env:PATH = "$HOME\miniforge3\envs\vts\Library\bin;$env:PATH"; & "$HOME\miniforge3\envs\vts\python.exe" render_reports.py`

Output goes to `output/` (not committed). The script ends with `ALL CHECKS PASSED` or lists what failed.

## Rules the reports follow

- **Method on every value.** Each nitrate value shows its method, kit or instrument and range (or laboratory and report date), date, whether water was flowing, and who recorded it by role.
- **Evidence levels.** Test strip = Field screening (a range). Portable photometer = Field measurement (a number, not a certified result). Laboratory = the performance check. Laboratory results go in the performance block; strips and photometer go in a separate "field checks" block.
- **Units.** Shown as mg/L as NO3-N with the NO3 equivalent in brackets. NO3 = NO3-N x 4.43. The value as entered is never changed.
- **Strips.** A strip reading is the closest color block. It is shown as the span between the neighbouring color blocks, in whole numbers, in both units.
- **Comparisons.** Inlet minus outlet only between the same method at the same visit, labelled a rough comparison. Never a percentage removal. Never a strip result against a laboratory result.
- **No laboratory result** for the year: "No laboratory result recorded this year". The strip result does not stand in for it.
- **Charts.** Points with dates, no smoothed or joined lines. Each method is its own series; laboratory and field checks are separate charts.
- **Load.** A load or removal block appears only when laboratory results and flow for the same time exist.
- **Privacy.** Shared exports never show the exact location (HUC-12 instead) or, by default, the project owner. The wildlife section of the Food Safety Record appears only if the project owner chooses. No crew names.
- **Sample data** is labelled on every page.
