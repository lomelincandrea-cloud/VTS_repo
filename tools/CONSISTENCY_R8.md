# R8.1 Consistency audit: manual sources vs site

Date: 2026-11-24. Manual state: batch A and A2 (commits 1dd0989, d9b62da).
Sources, in order: `docs/downloads/VTS_forms.xlsx` (F01, F02, F03, F05, F06, F07), `docs/downloads/<SYS>_F04_visual_inspection_checklist.xlsx`, the manual PDF and Field Guide PDF, `docs/learn_data.js`.
Rule: if the site differs, the site changes. If the manual sources disagree among themselves, the item is listed here for Andrea and not decided.

## A. Site differs from the manual (fixed on the site in R8)

| Item | What the manual says (file · sheet) | What the site said (file · route) | Wins | Fixed in R8? |
|---|---|---|---|---|
| F03 name | "Annual Plan" (VTS_forms.xlsx · VTS_F01, SB_F03…WB_F03) | "Yearly plan" (tool.js, tool_plan.js, tool_history.js, tool_dash.js, index.html · `#tool/plan`) | Manual | Yes, R8.2: "Annual plan (F03)" |
| F06 name, step 5 | "Site History" (VTS_F01, VTS_F06) | "Maintenance log" (index.html step 5, tool.js, tool_plan.js, tool_dash.js · `#tool/log`) | Manual | Yes, R8.2/R8.4: "Site History (F06)" |
| F05 name | "Corrective Maintenance Log" (VTS_F01, VTS_F05) | "Corrective log" (tool_history.js links) | Manual | Yes, R8.2 |
| After-storm check | "Post-storm visit" (manual 1.3 table, calendar; F03 notes; F04 legend "A = Post-storm") | "After storms" / "After storm" (learn.js The year, tool_plan.js visit names, index.html) | Manual | Yes, labels; stored value "After storm" still read |
| Document codes in running text | "the manual", "the Field Guide"; codes only in F01 and file names | "(VTS_D01)", "(VTS_D02)" in the materials table titles (app.js) and in Learn plants intro (learn.js) | Manual | Yes, codes kept only in the Code column of the downloads table and in file names |
| Checklist name | "inspection checklist" inside the Visit Sheet (manual, batch A) | "Visual inspection checklist" heading in the Visit Sheet record (tool_plan.js · `#tool/visit/<id>`) | Manual | Yes |
| Photo points (wording) | Manual text: "photos" / "overview photos of the system" (A2) | "Photo points" in the Visit Sheet record, Dashboard IND-10 label, register step | Manual | Partly: Visit Sheet block 4 says "Photos"; Site Conditions keeps the F04 field (see B) |
| Manual PDF file name | `VTS_D01_OM_Manual_draft_for_review_2026-11-24.pdf` | Downloads table and annexes pointed to the Nov 19 file | Manual | Yes, `build_site_data.py` picks the latest file; links checked |
| Visit Sheet record | F04: header (Site / VTS ID, Date, Inspector, Visit type, Last rain, Weather), Site Conditions, all checklist items of the visit type (R / A / P), spring water check, before you leave, crew size, hours | Only answered items, by code, without the question (`#tool/visit/<id>`) | Manual | Yes, R8.3 |
| Site History columns | F06: Date · Visit type · Crew members · Hours (crew total) · Tasks performed · Notes · Corrective maintenance (F05 entry) · Supervisor initials | Date · VTS · Kind · What · Result · Status (`#tool/log`) | Manual | Yes, R8.4 |
| Corrective record columns | F05: Date · Finding (from the checklist) · Location · Likely cause · Action taken · Urgency · Materials used · Hours · Resolved / escalated · Photos (before / after) | Card without Likely cause, Materials used, Hours, Photos | Manual | Yes, R8.4 (open row shows the F05 columns) |
| Sediment removal | Manual 2.2/2.4/2.6 tables and 3.4.1: conditional, best after the storm season (around April), only if the post-storm visits show it is needed; capacity before October 1. WB: check that sediment is not entering | Learn "The year": under "When needed" only; no WB check | Manual (PDF) | Yes, R8.7 wheel and Learn; Annual plan shows it as conditional |
| Section order of Learn topics | Manual: 1.3 Preventive Maintenance, 1.4 Monitoring and Records, 1.5 Health and Safety, 1.6 Waste Management | Learn read the old order | Manual | Yes: `learn_data.js` rebuilt from the manual source |
| Task pages | Responsibilities first, Escalation last (manual, batch A) | Learn task page box order | Manual | Yes |

## B. Manual sources disagree among themselves (for Andrea; not changed)

| Item | Source 1 | Source 2 | Note |
|---|---|---|---|
| Name of the whole F04 form | Manual and F01: "Visit Sheet (F04)" | F04 Excel: title "INSPECTION CHECKLIST — <SYSTEM>" and file name `<SYS>_F04_visual_inspection_checklist.xlsx` | The site says "Visit Sheet (F04)". Excel title and file name need the manual fix. |
| F04 description in F01 | F01 (VTS_forms.xlsx · VTS_F01, rows SB_F04…WB_F04): "…the visual inspection checklist…" | Batch A: "inspection checklist" | Wording only. |
| Photo points | Manual text (A2): no "photo points" | F04 Excel · Checklist: Site Conditions field "Photo points (number and where they are marked)" and "Overview photos taken from all photo points" in Before you leave; manual appendix Visit Sheets (same rows); Site_Params sheet of the manual source | The site Site Conditions block follows the F04 wording, as asked. |
| Jar question | Manual 1.4 table: "Outlet jar less murky/brown than the inlet jar" | F04 Excel · Checklist, spring block: "Is the outlet jar clearer than the inlet jar?"; Water Check action table: "clearer" | Wording only. |
| "How to use" sheet of F04 | Columns are R / A / P | F04 Excel · How to use, line 1: "(R / A / S show where each item applies)" | Letter S should be P. |
| Sediment removal in F02 / F03 | Manual PDF tables (2.2, 2.4, 2.6): own row "Sediment removal", conditional; WB "Sediment check" row | VTS_forms.xlsx · SB/TW/VD_F02 and _F03: Sediment Removal only under "When needed" / "as needed"; no WB sediment check | The site shows the manual PDF version (conditional). The Annual plan Excel note (R8.5) depends on this: see R8.5. |
| Manual 1.3 "Visits: what is done in each one" | Per-system tables: separate conditional "Sediment removal" row | General table in 1.3: Sediment Removal still inside "When needed" | Layout only. |
| Post-storm visit in F03 | Manual 1.3 table and calendar: "Post-storm visit" is a visit | F03: no "Post-storm visit" row; it lives in the notes of the Routine Visual Inspection row | Not a conflict in content; noted because R8.5 compares visits. |
| Control structures task name | SB_F02/VD_F02: "Test and Clear All Control Structures" | TW_F02: "Test and Clear Control Structures" (and the manual group page uses the short name) | Names differ between systems. |
| Spring visit | Manual 1.3 table and calendar: separate "Spring visit, in April" row (Vegetation Survey SB/TW/VD; Water Check TW/VD/WB) | Sediment removal "around April" is a separate conditional row, not part of the spring visit | Reported in Part 0; the site follows the manual (spring visit stays). |

## C. Checked and equal

| Item | Result |
|---|---|
| Task ids and titles (SB_T01…WB_T09, COR_T01…COR_T07) | F02, F03, F04 Task index and `learn_data.js` come from the same manual source; ids and titles equal. |
| Visits per system and months | F03: Routine (every visit), Spring (Apr), Pre-storm (Aug), January review (Jan), When needed. Same in `learn_data.js` and in the Tool plan rows (built from it). |
| F01 names of forms and documents | Used as written in the downloads table. |
