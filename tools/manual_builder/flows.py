"""Genera diagramas de flujo de tareas (inicio / acción / decisión / aviso / fin) a partir de un texto corto."""
import re, textwrap, subprocess, shutil
BLUE, BLUE_L, YELLOW, RED, RED_L = "#03467E", "#E6F0F9", "#F6B800", "#B4361F", "#FBE3DD"
FONT = "Public Sans"

def parse_flow(spec):
    """Formato:  id: texto      (id termina en ? = decisión, ! = aviso al supervisor; 'start' y 'end' son inicio y fin)
                 a -> b -> c    (flujo)      d -yes-> x    d -no-> y   (ramas de una decisión)"""
    nodes, edges = {}, []
    for line in [l.strip() for l in spec.strip().splitlines() if l.strip() and not l.strip().startswith("#")]:
        if "->" in line and not re.match(r"^\w+[?!]?\s*:", line):
            toks = re.split(r"\s*(-\w+->|->)\s*", line)
            for i in range(0, len(toks) - 2, 2):
                a, arrow, b = toks[i].strip(), toks[i + 1], toks[i + 2].strip()
                lab = arrow[1:-2].upper() if arrow != "->" else ""
                edges.append((a, b, lab))
        else:
            k, label = line.split(":", 1); k = k.strip(); kind = "decision" if k.endswith("?") else "notify" if k.endswith("!") else "start" if k.startswith("start") else "end" if k.startswith("end") else "action"
            nodes[k.rstrip("?!")] = (kind, label.strip())
    edges = [(a.rstrip("?!"), b.rstrip("?!"), l) for a, b, l in edges]
    for a, b, _ in edges:
        assert a in nodes and b in nodes, f"nodo sin definir: {a} / {b}"
    return nodes, edges

def to_dot(nodes, edges, width=30):
    L = ['digraph G {', f'graph [rankdir=TB, nodesep=0.28, ranksep=0.24, pad=0.08, bgcolor="transparent", splines=spline];',
         f'node [fontname="{FONT}", fontsize=10.5, margin="0.11,0.05"]; edge [fontname="{FONT}", fontsize=9, arrowsize=0.7, color="{BLUE}", penwidth=1.3];']
    for k, (kind, label) in nodes.items():
        lab = "\\n".join(textwrap.wrap(label, 19 if kind == "decision" else width)).replace('"', "'")
        if kind in ("start", "end"): L.append(f'{k} [label="{lab}", shape=box, style="rounded,filled", fillcolor="{BLUE}", color="{BLUE}", fontcolor="white", fontname="{FONT} Bold"];')
        elif kind == "decision": L.append(f'{k} [label="{lab}", shape=diamond, style=filled, fillcolor="{YELLOW}", color="#B88A00", fontcolor="#3A2A00", margin="0.02,0.02"];')
        elif kind == "notify": L.append(f'{k} [label="{lab}", shape=box, style="rounded,filled", fillcolor="{RED_L}", color="{RED}", fontcolor="#7A1F10", penwidth=1.4];')
        else: L.append(f'{k} [label="{lab}", shape=box, style="rounded,filled", fillcolor="{BLUE_L}", color="{BLUE}", fontcolor="#10263B"];')
    for a, b, lab in edges:
        col = "#2F8F4E" if lab == "YES" else RED if lab == "NO" else BLUE
        L.append(f'{a} -> {b} [' + (f'label=<<B> {lab} </B>>, fontcolor="{col}", color="{col}"' if lab else '') + '];')
    L.append("}"); return "\n".join(L)

def render_flow(spec, out_base, formats=("svg", "png")):
    nodes, edges = parse_flow(spec); dot = to_dot(nodes, edges)
    for f in formats:
        subprocess.run(["dot", f"-T{f}", "-Gdpi=200"] if f == "png" else ["dot", f"-T{f}"], input=dot.encode(), stdout=open(f"{out_base}.{f}", "wb"), check=True)
    open(f"{out_base}.dot", "w").write(dot); return nodes, edges
