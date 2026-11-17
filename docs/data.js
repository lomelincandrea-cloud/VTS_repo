// Task catalogue for the demo tool. One row per task:
// [task id, system code, task name, visit, component, months, notes]
//
// PROVISIONAL (15 Nov 2026): these 39 rows are the earlier prototype's tasks, renamed and
// regrouped by hand with the Nov 2026 visit names (Routine visit, Pre-storm visit in Aug,
// Spring visit in Apr, January review, When needed). The source of truth is
// tools/manual_builder/data/VTS_manual_content.xlsx; replace this file with the output of
// tools/build_site_data.py once that script writes this format. New tasks in the manual
// (Animal Burrows and Activity, Erosion and Berm Repair, Pump Repair or Replacement, ...)
// are not here yet.
const TASKS=[["SB_T01","SB","Routine Visual Inspection","Routine visit","Inspection","Jan-Dec","At every routine visit. Also after significant storm or irrigation events."],
 ["SB_T02","SB","Remove Trash and Debris","Routine visit","Housekeeping","Jan-Dec","At every routine visit."],
 ["SB_T03","SB","Vegetation Maintenance","Pre-storm visit","Vegetation","Aug","Pre-storm visit (August), and whenever an inspection finds overgrown vegetation, weeds, or bare…"],
 ["SB_T04","SB","Test and Clear All Control Structures","Pre-storm visit","Flow / structure","Aug","Pre-storm visit (August), and whenever an inspection finds a blockage or malfunction."],
 ["SB_T05","SB","Sediment Monitoring","Spring visit","Sediment","Apr","Spring visit (April). Readings at the fixed reference points are also part of each Routine Visual…"],
 ["SB_T06","SB","Vegetation Survey","Spring visit","Vegetation","Apr","Spring visit (April), in the growing season, or when an inspection finds a vegetation concern."],
 ["SB_T07","SB","Condition Check","Spring visit","Structure","Apr","Spring visit (April). A comprehensive review by a qualified professional is triggered by a concern found in an inspection…"],
 ["SB_T08","SB","Site History Review","January review (office)","Records","Jan","January review (office), during annual maintenance planning."],
 ["SB_T09","SB","Sediment Removal","When needed","Sediment","","When sediment reaches the site-specific cleanout level or reduces basin performance. Schedule…"],
 ["TW_T01","TW","Routine Visual Inspection","Routine visit","Inspection","Jan-Dec","At every routine visit. Also after significant storm or irrigation events."],
 ["TW_T02","TW","Remove Trash and Debris","Routine visit","Housekeeping","Jan-Dec","At every routine visit."],
 ["TW_T03","TW","Vegetation Maintenance","Pre-storm visit","Vegetation","Aug","Pre-storm visit (August), and whenever an inspection finds overgrown vegetation, weeds, or bare…"],
 ["TW_T04","TW","Test and Clear Control Structures","Pre-storm visit","Flow / structure","Aug","Pre-storm visit (August), and whenever an inspection finds a blockage or malfunction. Applies only…"],
 ["TW_T05","TW","Sediment Monitoring","Spring visit","Sediment","Apr","Spring visit (April). Readings at the fixed reference points are also part of each Routine Visual…"],
 ["TW_T06","TW","Vegetation Survey","Spring visit","Vegetation","Apr","Spring visit (April), in the growing season, or when an inspection finds a vegetation concern."],
 ["TW_T07","TW","Water Check","Spring visit","Water quality","Apr","Spring visit (April), or as set by the site's monitoring plan."],
 ["TW_T08","TW","Condition Check","Spring visit","Structure","Apr","Spring visit (April). A comprehensive review by a qualified professional is triggered by a concern found in an inspection…"],
 ["TW_T09","TW","Site History Review","January review (office)","Records","Jan","January review (office), during annual maintenance planning."],
 ["TW_T10","TW","Sediment Removal","When needed","Sediment","","After the cleanout level is reached and removal is authorized."],
 ["VD_T01","VD","Routine Visual Inspection","Routine visit","Inspection","Jan-Dec","At every routine visit. Also after significant storm or irrigation events."],
 ["VD_T02","VD","Remove Trash and Debris","Routine visit","Housekeeping","Jan-Dec","At every routine visit."],
 ["VD_T03","VD","Vegetation Maintenance","Pre-storm visit","Vegetation","Aug","Pre-storm visit (August), and whenever an inspection finds weeds, overgrowth, or bare areas. These…"],
 ["VD_T04","VD","Test and Clear All Control Structures","Pre-storm visit","Flow / structure","Aug","Pre-storm visit (August), and whenever a routine inspection finds a blockage or malfunction."],
 ["VD_T05","VD","Sediment Monitoring","Spring visit","Sediment","Apr","Spring visit (April). Readings at the fixed reference points are also part of each Routine Visual…"],
 ["VD_T06","VD","Inspect Ditch Cross-Section","Spring visit","Structure","Apr","Spring visit (April), once a year."],
 ["VD_T07","VD","Vegetation Survey","Spring visit","Vegetation","Apr","Spring visit (April), in the growing season, or when an inspection finds a vegetation concern."],
 ["VD_T08","VD","Water Check","Spring visit","Water quality","Apr","Spring visit (April), or as set by the site's monitoring plan."],
 ["VD_T09","VD","Condition Check","Spring visit","Structure","Apr","Spring visit (April). A comprehensive review by a qualified professional is triggered by a concern found in an inspection…"],
 ["VD_T10","VD","Site History Review","January review (office)","Records","Jan","January review (office), during annual maintenance planning."],
 ["VD_T11","VD","Sediment Removal","When needed","Sediment","","When sediment reaches the site-specific removal threshold, restricts water flow, or causes water…"],
 ["WB_T01","WB","Routine Visual Inspection","Routine visit","Inspection","Jan-Dec","At every routine visit. Also after significant storm or irrigation events."],
 ["WB_T02","WB","Remove Trash and Debris","Routine visit","Housekeeping","Jan-Dec","At every routine visit."],
 ["WB_T03","WB","Vegetation Maintenance","Routine visit","Vegetation","Jan-Dec","Whenever the vegetation is above the target height. Cut it at routine visits."],
 ["WB_T04","WB","Control Structure and Stoplog Service","Pre-storm visit","Flow / structure","Aug","Pre-storm visit (August), in the dry season after the water is gone, and whenever an inspection finds a blockage or…"],
 ["WB_T05","WB","Check Water Drainage","Pre-storm visit","Flow","Aug","Pre-storm visit (August). Perform in the dry season, when there is no water flowing into the bioreactor."],
 ["WB_T06","WB","Water Check","Spring visit","Water quality","Apr","Spring visit (April), or as set by the site's monitoring plan."],
 ["WB_T07","WB","Test Pipes and Joints for Leaks","Spring visit","Structure","Apr","Spring visit (April)."],
 ["WB_T08","WB","Condition Check","Spring visit","Structure","Apr","Spring visit (April). A comprehensive review by a qualified professional is triggered by a concern found in an inspection…"],
 ["WB_T09","WB","Site History Review","January review (office)","Records","Jan","January review (office), during annual maintenance planning."]];
