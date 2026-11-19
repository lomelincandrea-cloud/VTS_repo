/* Data adapter for the Tool. The screens only call these functions, so the prototype storage (the viewer's own browser)
   can later be swapped for a server (for example Supabase) without changing the screens.
   Model: tools/report_templates/data_schema.json. Records start from tool/sample_data.json (Sample data). */
window.VTSStore = (function () {
  "use strict";
  const KEY = "vts_tool_demo_v1", SESSION = "vts_tool_session_v1";
  let base = null, data = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  const now = () => new Date().toISOString().slice(0, 19);
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked: changes last until reload */ } }

  async function load() {
    if (data) return data;
    base = await fetch("tool/sample_data.json", {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error("sample data " + r.status); return r.json(); });
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { saved = null; }
    data = saved && saved.meta ? saved : clone(base);
    return data;
  }
  function reset() { data = clone(base); try { localStorage.removeItem(KEY); } catch (e) {} return data; }
  function edited() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }

  /* session: demo only, no password */
  function session() { try { return JSON.parse(localStorage.getItem(SESSION) || "null"); } catch (e) { return null; } }
  function signIn() { const s = {user: "Demo user", role: "supervisor", org: data ? data.organization.name : "Sample organization", since: now()}; try { localStorage.setItem(SESSION, JSON.stringify(s)); } catch (e) {} return s; }
  function signOut() { try { localStorage.removeItem(SESSION); } catch (e) {} }

  /* reads */
  const sites = () => data.sites;
  const site = id => data.sites.find(s => s.id === id);
  const visitsOf = id => data.visits.filter(v => v.site === id).sort((a, b) => a.date.localeCompare(b.date));
  const planOf = (id, year) => data.annual_plans.find(p => p.site === id && p.year === year);
  const revisionsOf = id => data.revisions.filter(r => r.record_id === id);

  /* writes. Every change to an existing record keeps the old value and a reason (edit history). */
  function update(collection, id, patch, reason, category) {
    const rec = data[collection].find(r => r.id === id);
    if (!rec) throw new Error(`${collection} ${id} not found`);
    if (!reason || !String(reason).trim()) throw new Error("A reason is required for every change.");
    const who = (session() || {}).role || "unknown";
    for (const [field, value] of Object.entries(patch)) {
      data.revisions.push({id: "R-" + (data.revisions.length + 1).toString().padStart(3, "0") + "-" + Date.now().toString(36), record_type: collection.replace(/s$/, ""), record_id: id,
                           field, old_value: rec[field] === undefined ? null : clone(rec[field]), new_value: clone(value), reason: String(reason).trim(), category: category || null, who_role: who, when: now()});
      rec[field] = clone(value);
    }
    persist(); return rec;
  }
  function add(collection, record) { data[collection].push(clone(record)); persist(); return record; }
  function nextId(collection, prefix) { let n = data[collection].length + 1; while (data[collection].some(r => r.id === prefix + n)) n++; return prefix + n; }

  return {load, reset, edited, session, signIn, signOut, sites, site, visitsOf, planOf, revisionsOf, update, add, nextId, get data() { return data; }};
})();
