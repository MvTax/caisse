#!/usr/bin/env python3
"""Fabrique testeur-impression.py : serveur.py + index.html dans un seul fichier.

À relancer après chaque modification de index.html ou serveur.py :
    python3 outils/assembler.py
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKER = "EMBEDDED_HTML = None\n"

with open(os.path.join(ROOT, "serveur.py"), encoding="utf-8") as f:
    server = f.read()
with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
    html = f.read()

if server.count(MARKER) != 1:
    raise SystemExit("Marqueur EMBEDDED_HTML introuvable dans serveur.py")

header = (
    "# FICHIER GÉNÉRÉ par outils/assembler.py à partir de serveur.py et index.html.\n"
    "# Ne pas le modifier à la main : modifiez les sources puis relancez l'assembleur.\n"
)
out = server.replace(MARKER, "EMBEDDED_HTML = " + repr(html) + "\n")
lines = out.split("\n", 1)  # garder le shebang en première ligne
out = lines[0] + "\n" + header + lines[1]

dest = os.path.join(ROOT, "testeur-impression.py")
with open(dest, "w", encoding="utf-8", newline="\n") as f:
    f.write(out)
os.chmod(dest, 0o755)
print(f"Écrit : {dest} ({len(out) // 1024} Ko)")
