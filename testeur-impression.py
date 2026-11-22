#!/usr/bin/env python3
# FICHIER GÉNÉRÉ par outils/assembler.py à partir de serveur.py et index.html.
# Ne pas le modifier à la main : modifiez les sources puis relancez l'assembleur.
"""Serveur local du testeur d'impression.

Un navigateur ne peut pas parler directement à une imprimante réseau (IP:9100).
Ce petit serveur (Python 3, aucune dépendance) le fait à sa place :
  - sert la page index.html sur http://127.0.0.1:8642
  - ping et test des ports d'une IP d'imprimante
  - lecture de l'état de l'imprimante (papier, capot…) en ESC/POS
  - recherche des imprimantes réseau (port 9100) sur le réseau local
  - envoi brut des tickets ESC/POS à l'imprimante
  - liste des imprimantes installées et impression d'une page texte via le système

Lancement : python3 serveur.py   (ou double-clic sur lancer.bat / lancer.sh)
"""
import base64
import concurrent.futures
import ipaddress
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("TESTEUR_PORT", "8642"))
HERE = os.path.dirname(os.path.abspath(__file__))
IS_WIN = platform.system() == "Windows"
VERSION = "1.1"

# Page intégrée : remplie par outils/assembler.py pour produire testeur-impression.py,
# un fichier unique qui n'a pas besoin d'index.html à côté.
EMBEDDED_HTML = '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Testeur d\'impression</title>\n<style id="page-style"></style>\n<style>\n  :root {\n    --bg: #f2f0eb;\n    --panel: #ffffff;\n    --ink: #1c1c1e;\n    --muted: #6b6a66;\n    --line: #dcd8cf;\n    --accent: #1f6f5c;\n    --accent-soft: #e3efe9;\n    --danger: #a33b2b;\n  }\n  * { box-sizing: border-box; }\n  [hidden] { display: none !important; }\n  body {\n    margin: 0;\n    background: var(--bg);\n    color: var(--ink);\n    font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;\n  }\n  header { padding: 20px 24px 8px; }\n  header h1 { margin: 0; font-size: 22px; }\n  header p { margin: 2px 0 0; color: var(--muted); }\n  main {\n    display: grid;\n    grid-template-columns: minmax(320px, 520px) 1fr;\n    gap: 20px;\n    padding: 12px 24px 32px;\n    align-items: start;\n  }\n  @media (max-width: 860px) {\n    main { grid-template-columns: 1fr; padding: 12px 16px 32px; }\n    header { padding: 16px 16px 4px; }\n  }\n  .card {\n    background: var(--panel);\n    border: 1px solid var(--line);\n    border-radius: 10px;\n    padding: 16px;\n    margin-bottom: 14px;\n  }\n  .card h2 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }\n  label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; }\n  input, select, textarea, button { font: inherit; color: inherit; }\n  input[type=text], input[type=number], select, textarea {\n    width: 100%;\n    padding: 7px 9px;\n    border: 1px solid var(--line);\n    border-radius: 6px;\n    background: #fff;\n  }\n  textarea { resize: vertical; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 14px; }\n  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }\n  .grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }\n  .field { margin-bottom: 10px; }\n  .check { display: inline-flex; align-items: center; gap: 6px; color: var(--ink); font-size: 14px; margin: 0 14px 0 0; }\n  .row-opts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 4px; margin-top: 8px; }\n  .row-opts select { width: auto; }\n\n  .tabs { display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid var(--line); }\n  .tab {\n    border: 0; background: none; padding: 8px 12px; cursor: pointer;\n    color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px;\n  }\n  .tab[aria-selected=true] { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }\n  .pane[hidden] { display: none; }\n\n  .btn {\n    border: 1px solid var(--line); background: #fff; border-radius: 6px;\n    padding: 7px 12px; cursor: pointer;\n  }\n  .btn:hover { border-color: #b9b4a8; }\n  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }\n  .btn.primary:hover { filter: brightness(1.08); }\n  .btn.big { padding: 11px 18px; font-size: 16px; }\n  .btn:disabled { opacity: .5; cursor: not-allowed; }\n  .actions { display: flex; flex-wrap: wrap; gap: 8px; }\n\n  table.items { width: 100%; border-collapse: collapse; margin-bottom: 8px; }\n  table.items th { text-align: left; font-weight: 500; font-size: 12px; color: var(--muted); padding: 0 4px 4px; }\n  table.items td { padding: 2px; }\n  table.items td:nth-child(2) { width: 64px; }\n  table.items td:nth-child(3) { width: 90px; }\n  table.items td:nth-child(4) { width: 34px; }\n  .del { border: 0; background: none; color: var(--danger); cursor: pointer; font-size: 18px; line-height: 1; }\n\n  .help { font-size: 13px; color: var(--muted); margin: 8px 0 0; }\n  .help code { background: var(--accent-soft); color: var(--ink); padding: 0 4px; border-radius: 3px; }\n  .status { font-size: 13px; margin-top: 8px; color: var(--muted); }\n  .status.ok { color: var(--accent); }\n  .status.err { color: var(--danger); }\n  details summary { cursor: pointer; font-weight: 600; }\n  details[open] summary { margin-bottom: 10px; }\n\n  .preview-wrap { position: sticky; top: 12px; }\n  .preview-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 0 0 8px; }\n  .preview-head h2 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }\n  .preview-head span { font-size: 13px; color: var(--muted); }\n  #preview {\n    background: #e4e1da;\n    border-radius: 10px;\n    padding: 24px 12px;\n    display: flex;\n    justify-content: center;\n    overflow: auto;\n    max-height: calc(100vh - 80px);\n  }\n\n  /* Le ticket lui-même (aperçu et impression) */\n  .paper {\n    background: #fff;\n    color: #000;\n    overflow: hidden;\n    box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 6px 18px rgba(0,0,0,.10);\n    font-family: "Courier New", Courier, monospace;\n    line-height: 1.25;\n    flex: none;\n  }\n  .paper .r { white-space: pre; }\n  .paper .r.b { font-weight: 700; }\n  .paper .r.big { font-size: 2em; line-height: 1.15; }\n\n  .diag { list-style: none; padding: 0; margin: 12px 0 0; }\n  .diag:empty { display: none; }\n  .diag li { display: grid; grid-template-columns: 24px 1fr; gap: 4px 6px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 14px; }\n  .diag li .i { font-size: 15px; line-height: 1.35; }\n  .diag li .d { color: var(--muted); font-size: 13px; margin-top: 2px; }\n  .diag li .d code { background: var(--accent-soft); color: var(--ink); padding: 0 4px; border-radius: 3px; }\n  .diag li .a { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }\n  .diag li .a .btn { padding: 4px 10px; font-size: 13px; }\n  .diag li.err b { color: var(--danger); }\n  .diag li.ok b { color: var(--accent); }\n  .online { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; background: var(--accent-soft); font-size: 14px; }\n  .online[hidden] { display: none; }\n  .online p { margin: 0 0 6px; }\n  .online ol { margin: 0; padding-left: 20px; }\n  .online li { margin-bottom: 6px; }\n  .online pre { white-space: pre-wrap; word-break: break-all; background: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; font-size: 12px; margin: 6px 0; }\n  .notice { margin: 10px 0 0; padding: 8px 10px; border-radius: 6px; background: #fbeae6; color: var(--danger); font-size: 14px; }\n  .notice[hidden] { display: none; }\n\n  #printArea { position: absolute; left: -10000px; top: 0; }\n  #printArea .paper { box-shadow: none; }\n\n  @media print {\n    body { background: #fff; }\n    body > *:not(#printArea) { display: none !important; }\n    #printArea { position: static; }\n    #printArea .paper { break-after: page; page-break-after: always; }\n    #printArea .paper:last-child { break-after: auto; page-break-after: auto; }\n  }\n</style>\n</head>\n<body>\n\n<header>\n  <h1>Testeur d\'impression</h1>\n  <p>Écrivez du texte ou simulez un ticket de caisse, puis imprimez.</p>\n</header>\n\n<main>\n  <section>\n    <div class="card" id="diagCard">\n      <h2>Diagnostic</h2>\n      <div class="grid3" id="ipRow">\n        <div style="grid-column: span 2">\n          <label for="ip">IP de l\'imprimante (si elle est en réseau)</label>\n          <input id="ip" type="text" placeholder="ex. 192.168.1.50" autocomplete="off" spellcheck="false">\n        </div>\n        <div>\n          <label for="ipPort">Port</label>\n          <input id="ipPort" type="number" min="1" max="65535" value="9100">\n        </div>\n      </div>\n      <div class="actions" style="margin-top:10px">\n        <button class="btn primary" id="diagBtn" type="button">🔧 Lancer le test</button>\n        <button class="btn" id="scanBtn" type="button">🔍 Chercher les imprimantes réseau</button>\n        <button class="btn" id="ipPrintBtn" type="button">🖨 Imprimer sur l\'IP</button>\n      </div>\n      <div class="online" id="onlineBox" hidden>\n        <p><b>Version en ligne.</b> Depuis cette page (HTTPS), le navigateur ne peut pas joindre l\'imprimante ticket :\n          le bouton Imprimer passe seulement par AirPrint.</p>\n        <p><b>Pour tester l\'imprimante ticket depuis l\'iPhone :</b></p>\n        <ol>\n          <li>Sur l\'ordinateur de caisse : touche Windows, tapez <code>cmd</code>, clic droit sur « Invite de commandes »\n            → « Exécuter en tant qu\'administrateur », collez cette commande puis Entrée :\n            <pre id="bridgeCmd"></pre>\n            <button class="btn" id="copyCmd" type="button">Copier la commande</button>\n          </li>\n          <li>Sur l\'iPhone, en Wi-Fi sur le réseau de la boutique, ouvrez\n            <a id="bridgeLink" href="http://192.168.1.122:8080">http://192.168.1.122:8080</a> :\n            c\'est ce testeur, et cette fois il imprime vraiment.</li>\n          <li>Pour revenir à l\'app de caisse : Ctrl+C dans la fenêtre noire, puis relancez la commande habituelle de la passerelle.</li>\n        </ol>\n      </div>\n      <ol class="diag" id="diagOut"></ol>\n    </div>\n\n    <div class="card">\n      <h2>Papier</h2>\n      <div class="grid3">\n        <div>\n          <label for="paper">Format</label>\n          <select id="paper">\n            <option value="58">Ticket 58 mm</option>\n            <option value="80" selected>Ticket 80 mm</option>\n            <option value="a4">Feuille A4</option>\n          </select>\n        </div>\n        <div>\n          <label for="cols">Caractères / ligne</label>\n          <input id="cols" type="number" min="16" max="120" value="48">\n        </div>\n        <div>\n          <label for="copies">Copies</label>\n          <input id="copies" type="number" min="1" max="20" value="1">\n        </div>\n      </div>\n    </div>\n\n    <div class="card">\n      <div class="tabs" role="tablist">\n        <button class="tab" role="tab" data-mode="text" aria-selected="true">Texte libre</button>\n        <button class="tab" role="tab" data-mode="ticket" aria-selected="false">Ticket de caisse</button>\n        <button class="tab" role="tab" data-mode="test" aria-selected="false">Page de test</button>\n      </div>\n\n      <!-- Texte libre -->\n      <div class="pane" data-pane="text">\n        <textarea id="freeText" rows="11"></textarea>\n        <div class="row-opts">\n          <select id="ftAlign" aria-label="Alignement">\n            <option value="left">Aligné à gauche</option>\n            <option value="center">Centré</option>\n            <option value="right">Aligné à droite</option>\n          </select>\n          <label class="check"><input type="checkbox" id="ftBold"> Gras</label>\n          <label class="check"><input type="checkbox" id="ftBig"> Grand</label>\n        </div>\n        <p class="help">\n          Raccourcis : <code># Titre</code> grand et centré, <code>## Sous-titre</code> gras centré,\n          <code>---</code> ou <code>===</code> séparateur, <code>^ texte</code> centré,\n          <code>&gt; texte</code> à droite, <code>**texte**</code> gras,\n          <code>gauche :: droite</code> deux colonnes.\n        </p>\n      </div>\n\n      <!-- Ticket -->\n      <div class="pane" data-pane="ticket" hidden>\n        <div class="field">\n          <label for="shop">Nom du commerce</label>\n          <input id="shop" type="text" value="Boulangerie du Coin">\n        </div>\n        <div class="field">\n          <label for="address">Adresse / infos (une par ligne)</label>\n          <textarea id="address" rows="3">12 rue de la Paix\n75002 Paris\nTél. 01 23 45 67 89</textarea>\n        </div>\n        <label>Articles</label>\n        <table class="items">\n          <thead><tr><th>Désignation</th><th>Qté</th><th>Prix unit. €</th><th></th></tr></thead>\n          <tbody id="items"></tbody>\n        </table>\n        <div class="actions" style="margin-bottom:12px">\n          <button class="btn" id="addItem" type="button">+ Ajouter un article</button>\n          <button class="btn" id="randomTicket" type="button">🎲 Ticket aléatoire</button>\n        </div>\n        <div class="grid3">\n          <div class="field">\n            <label for="vat">TVA %</label>\n            <input id="vat" type="number" min="0" step="0.1" value="5.5">\n          </div>\n          <div class="field">\n            <label for="payment">Paiement</label>\n            <select id="payment">\n              <option>Carte bancaire</option>\n              <option>Espèces</option>\n              <option>Chèque</option>\n              <option>Titre-restaurant</option>\n            </select>\n          </div>\n          <div class="field" id="givenField" hidden>\n            <label for="given">Montant donné €</label>\n            <input id="given" type="number" min="0" step="0.01" value="20">\n          </div>\n        </div>\n        <div class="field">\n          <label for="footer">Message de fin</label>\n          <input id="footer" type="text" value="Merci de votre visite, à bientôt !">\n        </div>\n        <label class="check"><input type="checkbox" id="testMark" checked> Ajouter la mention « TICKET DE TEST »</label>\n      </div>\n\n      <!-- Page de test -->\n      <div class="pane" data-pane="test" hidden>\n        <p style="margin:0">\n          Imprime une page de diagnostic : règle de colonnes pour vérifier la largeur,\n          alignements, gras, grande taille, accents et symboles (€, °, £…),\n          ainsi que tous les caractères ASCII.\n        </p>\n      </div>\n    </div>\n\n    <div class="card">\n      <div class="actions">\n        <button class="btn primary big" id="printBtn" type="button">🖨 Imprimer</button>\n      </div>\n      <p class="notice" id="printMsg" hidden></p>\n      <p class="help" id="printHelp">Ouvre la boîte d\'impression du navigateur : choisissez votre imprimante (thermique, laser, PDF…).\n        Pour une imprimante ticket, mettez les marges à « Aucune » et l\'échelle à 100 %.</p>\n    </div>\n\n    <div class="card" id="escposCard">\n      <details id="escposBox">\n        <summary>Impression directe ESC/POS (imprimante thermique)</summary>\n        <p class="help" style="margin-top:0">\n          Envoie les commandes brutes à l\'imprimante, sans pilote : coupe du papier, ouverture du tiroir-caisse…\n          Nécessite Chrome ou Edge. USB : l\'imprimante ne doit pas être réservée par un pilote\n          (sous Windows, utilisez plutôt le port série virtuel ou le fichier .bin).\n        </p>\n        <div class="grid2">\n          <div class="field">\n            <label for="codepage">Jeu de caractères</label>\n            <select id="codepage">\n              <option value="cp858">CP858 – accents + € (ESC t 19)</option>\n              <option value="cp850">CP850 – accents (ESC t 2)</option>\n              <option value="ascii">ASCII – sans accents</option>\n            </select>\n          </div>\n          <div class="field" id="baudField">\n            <label for="baud">Vitesse port série</label>\n            <select id="baud">\n              <option>9600</option><option>19200</option><option>38400</option>\n              <option>57600</option><option selected>115200</option>\n            </select>\n          </div>\n        </div>\n        <div class="row-opts" style="margin:0 0 10px">\n          <label class="check"><input type="checkbox" id="cut" checked> Couper le papier</label>\n          <label class="check"><input type="checkbox" id="drawerAfter"> Ouvrir le tiroir après impression</label>\n        </div>\n        <div class="actions">\n          <button class="btn" id="connectUsb" type="button">Connecter USB</button>\n          <button class="btn" id="connectSerial" type="button">Connecter port série</button>\n          <button class="btn primary" id="rawPrint" type="button" disabled>Imprimer en ESC/POS</button>\n          <button class="btn" id="drawer" type="button" disabled>Ouvrir le tiroir</button>\n          <button class="btn" id="download" type="button">Télécharger .bin</button>\n        </div>\n        <div class="status" id="status">Non connecté.</div>\n        <p class="help">\n          Le fichier <code>.bin</code> peut être envoyé directement à l\'imprimante :<br>\n          réseau : <code>nc 192.168.1.50 9100 &lt; ticket.bin</code><br>\n          Linux/macOS : <code>lp -d NomImprimante -o raw ticket.bin</code><br>\n          Windows : <code>copy /b ticket.bin \\\\NomPC\\NomPartage</code>\n        </p>\n      </details>\n    </div>\n  </section>\n\n  <section class="preview-wrap">\n    <div class="preview-head">\n      <h2>Aperçu</h2>\n      <span><span id="previewInfo"></span> &nbsp;<button class="btn" id="printBtn2" type="button">🖨 Imprimer</button></span>\n    </div>\n    <div id="preview"></div>\n  </section>\n</main>\n\n<div id="printArea"></div>\n\n<script>\n(() => {\n  const $ = (s) => document.querySelector(s);\n  const $$ = (s) => [...document.querySelectorAll(s)];\n\n  // ---------- Formats de papier ----------\n  // w = largeur papier, c = largeur imprimable, py = marge haut/bas (mm)\n  const PAPERS = {\n    58: { w: 58, c: 48, py: 3, cols: 32, label: \'58 mm\' },\n    80: { w: 80, c: 72, py: 3, cols: 48, label: \'80 mm\' },\n    a4: { w: 210, c: 180, py: 15, cols: 64, label: \'A4\' },\n  };\n  const CHAR_RATIO = 0.6; // largeur d\'un caractère Courier New / taille de police\n\n  function spec() {\n    const p = PAPERS[$(\'#paper\').value];\n    const W = Math.max(16, Math.min(120, parseInt($(\'#cols\').value, 10) || p.cols));\n    return { ...p, W, fs: p.c / (W * CHAR_RATIO) };\n  }\n\n  let mode = \'text\';\n\n  // ---------- Mise en page ----------\n  // Une "ligne" logique : {t:\'text\', s, align, bold, big} | {t:\'cols\', l, r, bold, big}\n  //                       {t:\'sep\', ch} | {t:\'feed\', n}\n  function wrap(s, w) {\n    s = s.replace(/\\s+$/, \'\');\n    if (s.length <= w) return [s];\n    const out = [];\n    let cur = \'\';\n    for (let word of s.split(/ +/)) {\n      while (word.length > w) {\n        if (cur) { out.push(cur); cur = \'\'; }\n        out.push(word.slice(0, w));\n        word = word.slice(w);\n      }\n      if (!cur) cur = word;\n      else if (cur.length + 1 + word.length <= w) cur += \' \' + word;\n      else { out.push(cur); cur = word; }\n    }\n    if (cur || !out.length) out.push(cur);\n    return out;\n  }\n\n  function align(s, w, a) {\n    if (a === \'right\') return s.padStart(w);\n    if (a === \'center\') return \' \'.repeat(Math.max(0, Math.floor((w - s.length) / 2))) + s;\n    return s;\n  }\n\n  function twoCols(l, r, w) {\n    return l + \' \'.repeat(Math.max(1, w - l.length - r.length)) + r;\n  }\n\n  function layout(lines, W) {\n    const rows = [];\n    for (const l of lines) {\n      const w = l.big ? Math.floor(W / 2) : W;\n      const st = { bold: !!l.bold, big: !!l.big };\n      if (l.t === \'sep\') {\n        rows.push({ ...st, s: (l.ch || \'-\').repeat(w) });\n      } else if (l.t === \'feed\') {\n        for (let i = 0; i < (l.n || 1); i++) rows.push({ s: \'\' });\n      } else if (l.t === \'cols\') {\n        const r = String(l.r ?? \'\');\n        const left = wrap(String(l.l ?? \'\'), w);\n        const last = left.pop();\n        left.forEach((s) => rows.push({ ...st, s }));\n        if (last.length + r.length + 1 <= w) rows.push({ ...st, s: twoCols(last, r, w) });\n        else { rows.push({ ...st, s: last }); rows.push({ ...st, s: r.padStart(w) }); }\n      } else {\n        wrap(String(l.s ?? \'\'), w).forEach((s) => rows.push({ ...st, s: align(s, w, l.align) }));\n      }\n    }\n    return rows;\n  }\n\n  // ---------- Contenu : texte libre ----------\n  function freeLines() {\n    const baseAlign = $(\'#ftAlign\').value;\n    const baseBold = $(\'#ftBold\').checked;\n    const big = $(\'#ftBig\').checked;\n    return $(\'#freeText\').value.split(\'\\n\').map((line) => {\n      const trimmed = line.trim();\n      if (/^(-{3,}|={3,}|\\*{3,})$/.test(trimmed)) return { t: \'sep\', ch: trimmed[0] };\n      if (line.startsWith(\'# \')) return { t: \'text\', s: line.slice(2), align: \'center\', bold: true, big: true };\n      if (line.startsWith(\'## \')) return { t: \'text\', s: line.slice(3), align: \'center\', bold: true, big };\n      let a = baseAlign, b = baseBold;\n      if (line.startsWith(\'^ \')) { a = \'center\'; line = line.slice(2); }\n      else if (line.startsWith(\'> \')) { a = \'right\'; line = line.slice(2); }\n      const t = line.trim();\n      if (t.length > 4 && t.startsWith(\'**\') && t.endsWith(\'**\')) { b = true; line = t.slice(2, -2); }\n      if (line.includes(\' :: \')) {\n        const [l, ...r] = line.split(\' :: \');\n        return { t: \'cols\', l, r: r.join(\' :: \'), bold: b, big };\n      }\n      return { t: \'text\', s: line, align: a, bold: b, big };\n    });\n  }\n\n  // ---------- Contenu : ticket de caisse ----------\n  const PRODUCTS = [\n    [\'Baguette tradition\', 1.30], [\'Croissant\', 1.20], [\'Pain au chocolat\', 1.40],\n    [\'Café expresso\', 1.80], [\'Cappuccino\', 3.20], [\'Eau minérale 50 cl\', 1.00],\n    [\'Jus d\\\'orange pressé\', 3.50], [\'Sandwich jambon-beurre\', 4.80], [\'Quiche lorraine\', 4.20],\n    [\'Éclair au café\', 2.70], [\'Tarte aux fraises\', 3.90], [\'Crème brûlée\', 3.60],\n    [\'Pain de campagne 400 g\', 2.90], [\'Chausson aux pommes\', 1.70], [\'Thé vert bio\', 2.30],\n    [\'Macaron (x6)\', 9.00], [\'Formule déjeuner\', 9.90], [\'Cookie chocolat\', 2.10],\n  ];\n  let items = [\n    { name: \'Baguette tradition\', qty: 2, price: 1.30 },\n    { name: \'Croissant\', qty: 3, price: 1.20 },\n    { name: \'Café expresso\', qty: 1, price: 1.80 },\n  ];\n  let ticketNo = rnd(1000, 99999);\n\n  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }\n  const num = (v) => { const n = parseFloat(String(v).replace(\',\', \'.\')); return isFinite(n) ? n : 0; };\n  const eur = (n) => n.toFixed(2).replace(\'.\', \',\') + \' €\';\n\n  function renderItems() {\n    const tb = $(\'#items\');\n    tb.innerHTML = \'\';\n    items.forEach((it, i) => {\n      const tr = document.createElement(\'tr\');\n      tr.innerHTML = `\n        <td><input type="text" data-k="name" aria-label="Désignation"></td>\n        <td><input type="number" data-k="qty" min="0" step="1" aria-label="Quantité"></td>\n        <td><input type="number" data-k="price" min="0" step="0.01" aria-label="Prix unitaire"></td>\n        <td><button class="del" type="button" title="Supprimer" aria-label="Supprimer">×</button></td>`;\n      tr.querySelector(\'[data-k=name]\').value = it.name;\n      tr.querySelector(\'[data-k=qty]\').value = it.qty;\n      tr.querySelector(\'[data-k=price]\').value = it.price.toFixed(2);\n      tr.querySelectorAll(\'input\').forEach((inp) => inp.addEventListener(\'input\', () => {\n        const k = inp.dataset.k;\n        items[i][k] = k === \'name\' ? inp.value : num(inp.value);\n        update();\n      }));\n      tr.querySelector(\'.del\').addEventListener(\'click\', () => { items.splice(i, 1); renderItems(); update(); });\n      tb.appendChild(tr);\n    });\n  }\n\n  function ticketLines() {\n    const L = [];\n    const now = new Date();\n    const date = now.toLocaleDateString(\'fr-FR\') + \' \' + now.toLocaleTimeString(\'fr-FR\', { hour: \'2-digit\', minute: \'2-digit\' });\n    const vat = num($(\'#vat\').value);\n    const pay = $(\'#payment\').value;\n\n    if ($(\'#testMark\').checked) L.push({ t: \'text\', s: \'*** TICKET DE TEST ***\', align: \'center\', bold: true }, { t: \'feed\' });\n    L.push({ t: \'text\', s: $(\'#shop\').value, align: \'center\', bold: true, big: true });\n    $(\'#address\').value.split(\'\\n\').filter((s) => s.trim()).forEach((s) => L.push({ t: \'text\', s: s.trim(), align: \'center\' }));\n    L.push({ t: \'sep\' });\n    L.push({ t: \'cols\', l: \'Ticket n° \' + String(ticketNo).padStart(6, \'0\'), r: date });\n    L.push({ t: \'cols\', l: \'Caisse 1\', r: \'Vendeur : Test\' });\n    L.push({ t: \'sep\' });\n\n    let total = 0, count = 0;\n    for (const it of items) {\n      if (!it.name && !it.price) continue;\n      const qty = it.qty || 0;\n      const line = qty * it.price;\n      total += line; count += qty;\n      if (qty === 1) L.push({ t: \'cols\', l: it.name, r: eur(line) });\n      else {\n        L.push({ t: \'text\', s: it.name });\n        L.push({ t: \'cols\', l: `   ${qty} x ${eur(it.price)}`, r: eur(line) });\n      }\n    }\n    L.push({ t: \'sep\' });\n    L.push({ t: \'cols\', l: `${count} article${count > 1 ? \'s\' : \'\'}`, r: \'\' });\n    L.push({ t: \'cols\', l: \'TOTAL\', r: eur(total), bold: true, big: true });\n    const ht = total / (1 + vat / 100);\n    L.push({ t: \'cols\', l: \'Total HT\', r: eur(ht) });\n    L.push({ t: \'cols\', l: `TVA ${String(vat).replace(\'.\', \',\')} %`, r: eur(total - ht) });\n    L.push({ t: \'sep\' });\n    if (pay === \'Espèces\') {\n      const given = num($(\'#given\').value);\n      L.push({ t: \'cols\', l: \'Espèces reçues\', r: eur(given) });\n      L.push({ t: \'cols\', l: \'Rendu monnaie\', r: eur(Math.max(0, given - total)), bold: true });\n    } else {\n      L.push({ t: \'cols\', l: pay, r: eur(total) });\n      if (pay === \'Carte bancaire\') L.push({ t: \'text\', s: \'Paiement sans contact - accepté\' });\n    }\n    L.push({ t: \'feed\' });\n    if ($(\'#footer\').value.trim()) L.push({ t: \'text\', s: $(\'#footer\').value.trim(), align: \'center\' });\n    if ($(\'#testMark\').checked) L.push({ t: \'feed\' }, { t: \'text\', s: \'Document sans valeur\', align: \'center\' });\n    return L;\n  }\n\n  // ---------- Contenu : page de test ----------\n  function testLines(W) {\n    const now = new Date().toLocaleString(\'fr-FR\');\n    let ruler = \'\', tens = \'\';\n    for (let i = 1; i <= W; i++) {\n      ruler += i % 10;\n      tens += i % 10 === 0 ? String(i / 10 % 10) : \' \';\n    }\n    let ascii = \'\';\n    for (let c = 33; c < 127; c++) ascii += String.fromCharCode(c);\n    return [\n      { t: \'text\', s: \'PAGE DE TEST\', align: \'center\', bold: true, big: true },\n      { t: \'text\', s: now, align: \'center\' },\n      { t: \'sep\', ch: \'=\' },\n      { t: \'text\', s: `Largeur : ${W} caractères par ligne` },\n      { t: \'text\', s: tens },\n      { t: \'text\', s: ruler },\n      { t: \'text\', s: \'La règle doit tenir sur une seule ligne, sans retour.\' },\n      { t: \'sep\' },\n      { t: \'text\', s: \'Aligné à gauche\' },\n      { t: \'text\', s: \'Centré\', align: \'center\' },\n      { t: \'text\', s: \'Aligné à droite\', align: \'right\' },\n      { t: \'cols\', l: \'Colonne gauche\', r: \'Colonne droite\' },\n      { t: \'sep\' },\n      { t: \'text\', s: \'Texte normal\' },\n      { t: \'text\', s: \'Texte en gras\', bold: true },\n      { t: \'text\', s: \'Grand texte\', big: true },\n      { t: \'text\', s: \'Grand et gras\', big: true, bold: true },\n      { t: \'sep\' },\n      { t: \'text\', s: \'Accents :\' },\n      { t: \'text\', s: \'à â ä é è ê ë î ï ô ö ù û ü ç ÿ\' },\n      { t: \'text\', s: \'À Â Ä É È Ê Ë Î Ï Ô Ö Ù Û Ü Ç\' },\n      { t: \'text\', s: \'Symboles : € £ $ ° % & @ # § µ ² ³ ½ « »\' },\n      { t: \'sep\' },\n      { t: \'text\', s: \'ASCII :\' },\n      { t: \'text\', s: ascii },\n      { t: \'sep\' },\n      { t: \'text\', s: \'Le vif zéphyr jubile sur les kumquats du clown gracieux.\' },\n      { t: \'text\', s: \'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789\' },\n      { t: \'sep\', ch: \'=\' },\n      { t: \'text\', s: \'Fin de la page de test\', align: \'center\', bold: true },\n    ];\n  }\n\n  function currentLines() {\n    if (mode === \'ticket\') return ticketLines();\n    if (mode === \'test\') return testLines(spec().W);\n    return freeLines();\n  }\n\n  // ---------- Rendu HTML ----------\n  function buildPaper(rows, sp, z) {\n    const paper = document.createElement(\'div\');\n    paper.className = \'paper\';\n    paper.style.width = sp.w * z + \'mm\';\n    paper.style.padding = `${sp.py * z}mm ${((sp.w - sp.c) / 2) * z}mm`;\n    paper.style.fontSize = sp.fs * z + \'mm\';\n    for (const r of rows) {\n      const d = document.createElement(\'div\');\n      d.className = \'r\' + (r.bold ? \' b\' : \'\') + (r.big ? \' big\' : \'\');\n      d.textContent = r.s.replace(/\\s+$/, \'\') || \'\\u00a0\';\n      paper.appendChild(d);\n    }\n    return paper;\n  }\n\n  function update() {\n    const sp = spec();\n    const rows = layout(currentLines(), sp.W);\n    const box = $(\'#preview\');\n    const avail = Math.max(200, box.clientWidth - 24);\n    const z = Math.min(1.7, avail / (sp.w * 96 / 25.4));\n    box.replaceChildren(buildPaper(rows, sp, z));\n    $(\'#previewInfo\').textContent = `${sp.label} · ${sp.W} car./ligne · ${rows.length} lignes`;\n  }\n\n  // ---------- Impression via le navigateur ----------\n  function printBrowser() {\n    const sp = spec();\n    const rows = layout(currentLines(), sp.W);\n    const area = $(\'#printArea\');\n    const one = buildPaper(rows, sp, 1);\n    area.replaceChildren(one);\n    const copies = Math.max(1, Math.min(20, parseInt($(\'#copies\').value, 10) || 1));\n    let pageCss;\n    if ($(\'#paper\').value === \'a4\') {\n      pageCss = \'@page { size: A4; margin: 0; }\';\n    } else {\n      const hmm = Math.ceil(one.getBoundingClientRect().height * 25.4 / 96) + 2;\n      pageCss = `@page { size: ${sp.w}mm ${hmm}mm; margin: 0; }`;\n    }\n    $(\'#page-style\').textContent = pageCss;\n    for (let i = 1; i < copies; i++) area.appendChild(one.cloneNode(true));\n    printState = { clicked: true, opened: false };\n    $(\'#printMsg\').hidden = true;\n    try { window.print(); } catch (e) { /* bloqué */ }\n    // Si la boîte d\'impression ne s\'est pas ouverte, on le dit au lieu de ne rien faire.\n    setTimeout(() => {\n      if (printState.opened || (IS_IOS && !inFrame())) return;\n      const m = $(\'#printMsg\');\n      m.hidden = false;\n      m.textContent = inFrame()\n        ? \'La boîte d\\\'impression ne s\\\'est pas ouverte : la page est affichée dans un aperçu intégré qui bloque l\\\'impression. Ouvrez index.html directement dans Chrome ou Edge (ou lancez lancer.bat / lancer.sh).\'\n        : \'La boîte d\\\'impression ne s\\\'est pas ouverte. Cliquez sur « Lancer le test » dans Diagnostic pour trouver la cause.\';\n    }, 1500);\n  }\n  let printState = { clicked: false, opened: false };\n  window.addEventListener(\'beforeprint\', () => { printState.opened = true; });\n  function inFrame() { try { return window.self !== window.top; } catch (e) { return true; } }\n\n  // ---------- ESC/POS ----------\n  const CP850 = {\n    \'Ç\':0x80,\'ü\':0x81,\'é\':0x82,\'â\':0x83,\'ä\':0x84,\'à\':0x85,\'å\':0x86,\'ç\':0x87,\'ê\':0x88,\'ë\':0x89,\n    \'è\':0x8A,\'ï\':0x8B,\'î\':0x8C,\'ì\':0x8D,\'Ä\':0x8E,\'Å\':0x8F,\'É\':0x90,\'æ\':0x91,\'Æ\':0x92,\'ô\':0x93,\n    \'ö\':0x94,\'ò\':0x95,\'û\':0x96,\'ù\':0x97,\'ÿ\':0x98,\'Ö\':0x99,\'Ü\':0x9A,\'ø\':0x9B,\'£\':0x9C,\'Ø\':0x9D,\n    \'×\':0x9E,\'á\':0xA0,\'í\':0xA1,\'ó\':0xA2,\'ú\':0xA3,\'ñ\':0xA4,\'Ñ\':0xA5,\'ª\':0xA6,\'º\':0xA7,\'¿\':0xA8,\n    \'®\':0xA9,\'¬\':0xAA,\'½\':0xAB,\'¼\':0xAC,\'¡\':0xAD,\'«\':0xAE,\'»\':0xAF,\'Á\':0xB5,\'Â\':0xB6,\'À\':0xB7,\n    \'©\':0xB8,\'¢\':0xBD,\'¥\':0xBE,\'ã\':0xC6,\'Ã\':0xC7,\'¤\':0xCF,\'Ê\':0xD2,\'Ë\':0xD3,\'È\':0xD4,\'Í\':0xD6,\n    \'Î\':0xD7,\'Ï\':0xD8,\'Ì\':0xDE,\'Ó\':0xE0,\'ß\':0xE1,\'Ô\':0xE2,\'Ò\':0xE3,\'õ\':0xE4,\'Õ\':0xE5,\'µ\':0xE6,\n    \'Ú\':0xE9,\'Û\':0xEA,\'Ù\':0xEB,\'ý\':0xEC,\'Ý\':0xED,\'´\':0xEF,\'±\':0xF1,\'¾\':0xF3,\'§\':0xF5,\'÷\':0xF6,\n    \'°\':0xF8,\'·\':0xFA,\'¹\':0xFB,\'³\':0xFC,\'²\':0xFD,\n  };\n  const CP858 = { ...CP850, \'€\': 0xD5 };\n  const TABLES = { cp850: CP850, cp858: CP858, ascii: {} };\n  const SUBST = { \'œ\':\'oe\',\'Œ\':\'OE\',\'’\':"\'",\'‘\':"\'",\'“\':\'"\',\'”\':\'"\',\'…\':\'...\',\'–\':\'-\',\'—\':\'-\',\'\\u00a0\':\' \',\'\\u202f\':\' \',\'Ÿ\':\'Y\' };\n\n  // Remplace ce que la page de code ne sait pas imprimer, AVANT la mise en page\n  // (pour que les colonnes restent alignées).\n  function sanitize(s, cp) {\n    const table = TABLES[cp];\n    let out = \'\';\n    for (const ch of String(s ?? \'\').normalize(\'NFC\')) {\n      if (ch.charCodeAt(0) < 128 || table[ch]) { out += ch; continue; }\n      if (SUBST[ch]) { out += SUBST[ch]; continue; }\n      if (ch === \'€\') { out += \'EUR\'; continue; }\n      const base = ch.normalize(\'NFD\').replace(/[\\u0300-\\u036f]/g, \'\');\n      out += base.length && base.charCodeAt(0) < 128 ? base : \'?\';\n    }\n    return out;\n  }\n\n  function encode(s, cp) {\n    const table = TABLES[cp];\n    const out = [];\n    for (const ch of s) {\n      const c = ch.charCodeAt(0);\n      out.push(c < 128 ? c : (table[ch] ?? 0x3F));\n    }\n    return out;\n  }\n\n  function escposBytes(override) {\n    const cp = $(\'#codepage\').value;\n    const sp = spec();\n    const lines = (override || currentLines()).map((l) => ({\n      ...l,\n      s: l.s !== undefined ? sanitize(l.s, cp) : undefined,\n      l: l.l !== undefined ? sanitize(l.l, cp) : undefined,\n      r: l.r !== undefined ? sanitize(l.r, cp) : undefined,\n    }));\n    const rows = layout(lines, sp.W);\n    const copies = override ? 1 : Math.max(1, Math.min(20, parseInt($(\'#copies\').value, 10) || 1));\n    const b = [0x1B, 0x40]; // ESC @ : initialisation\n    if (cp === \'cp858\') b.push(0x1B, 0x74, 19);\n    if (cp === \'cp850\') b.push(0x1B, 0x74, 2);\n    for (let c = 0; c < copies; c++) {\n      for (const r of rows) {\n        b.push(0x1B, 0x45, r.bold ? 1 : 0);         // ESC E : gras\n        b.push(0x1D, 0x21, r.big ? 0x11 : 0x00);    // GS ! : double hauteur + largeur\n        b.push(...encode(r.s.replace(/\\s+$/, \'\'), cp), 0x0A);\n      }\n      b.push(0x1B, 0x45, 0, 0x1D, 0x21, 0);\n      if ($(\'#cut\').checked) b.push(0x1D, 0x56, 0x42, 0x03); // GS V B : avance + coupe partielle\n      else b.push(0x1B, 0x64, 4);                          // ESC d 4 : avance 4 lignes\n    }\n    if (!override && $(\'#drawerAfter\').checked) b.push(...DRAWER);\n    return new Uint8Array(b);\n  }\n  const DRAWER = [0x1B, 0x70, 0x00, 0x19, 0xFA]; // ESC p 0 : impulsion tiroir\n\n  let conn = null;\n  function setStatus(msg, kind) {\n    const el = $(\'#status\');\n    el.textContent = msg;\n    el.className = \'status\' + (kind ? \' \' + kind : \'\');\n  }\n  function setConnected(c) {\n    conn = c;\n    $(\'#rawPrint\').disabled = !c;\n    $(\'#drawer\').disabled = !c;\n    if (c) setStatus(\'Connecté : \' + c.name, \'ok\');\n  }\n\n  async function connectUsb() {\n    if (!navigator.usb) return setStatus(\'WebUSB non disponible : utilisez Chrome ou Edge (via https, localhost ou fichier local).\', \'err\');\n    try {\n      if (conn) await conn.close().catch(() => {});\n      const dev = await navigator.usb.requestDevice({ filters: [] });\n      await dev.open();\n      if (!dev.configuration) await dev.selectConfiguration(1);\n      let found = null;\n      for (const itf of dev.configuration.interfaces) {\n        for (const alt of itf.alternates) {\n          const ep = alt.endpoints.find((e) => e.direction === \'out\' && e.type === \'bulk\');\n          if (ep && (!found || alt.interfaceClass === 7)) found = { itf, alt, ep };\n        }\n      }\n      if (!found) throw new Error(\'aucune sortie USB de type imprimante trouvée\');\n      await dev.claimInterface(found.itf.interfaceNumber);\n      if (found.alt.alternateSetting) await dev.selectAlternateInterface(found.itf.interfaceNumber, found.alt.alternateSetting);\n      setConnected({\n        name: (dev.manufacturerName ? dev.manufacturerName + \' \' : \'\') + (dev.productName || \'imprimante USB\'),\n        write: async (data) => {\n          for (let i = 0; i < data.length; i += 4096) await dev.transferOut(found.ep.endpointNumber, data.slice(i, i + 4096));\n        },\n        close: () => dev.close(),\n      });\n    } catch (e) {\n      if (e.name === \'NotFoundError\') return setStatus(\'Aucun appareil choisi.\');\n      setStatus(\'Échec USB : \' + e.message + (e.name === \'SecurityError\' || /claim|access/i.test(e.message)\n        ? \' (appareil réservé par un pilote ?)\' : \'\'), \'err\');\n    }\n  }\n\n  async function connectSerial() {\n    if (!navigator.serial) return setStatus(\'Web Serial non disponible : utilisez Chrome ou Edge.\', \'err\');\n    try {\n      if (conn) await conn.close().catch(() => {});\n      const port = await navigator.serial.requestPort();\n      await port.open({ baudRate: parseInt($(\'#baud\').value, 10) });\n      setConnected({\n        name: \'port série à \' + $(\'#baud\').value + \' bauds\',\n        write: async (data) => {\n          const w = port.writable.getWriter();\n          try { await w.write(data); } finally { w.releaseLock(); }\n        },\n        close: () => port.close(),\n      });\n    } catch (e) {\n      if (e.name === \'NotFoundError\') return setStatus(\'Aucun port choisi.\');\n      setStatus(\'Échec port série : \' + e.message, \'err\');\n    }\n  }\n\n  async function send(data, label) {\n    if (!conn) return;\n    try {\n      setStatus(\'Envoi…\');\n      await conn.write(data);\n      setStatus(`${label} envoyé (${data.length} octets) à ${conn.name}.`, \'ok\');\n    } catch (e) {\n      setStatus(\'Erreur d\\\'envoi : \' + e.message, \'err\');\n    }\n  }\n\n  function download() {\n    const blob = new Blob([escposBytes()], { type: \'application/octet-stream\' });\n    const a = document.createElement(\'a\');\n    a.href = URL.createObjectURL(blob);\n    a.download = mode === \'ticket\' ? \'ticket.bin\' : mode === \'test\' ? \'page-de-test.bin\' : \'texte.bin\';\n    a.click();\n    setTimeout(() => URL.revokeObjectURL(a.href), 1000);\n  }\n\n\n  // ---------- Serveur local + diagnostic ----------\n  // Trois façons d\'ouvrir ce testeur :\n  //  - en ligne (https, ex. github.io) : pas d\'accès réseau local, impression par la boîte du navigateur ;\n  //  - servi par serveur.py / testeur-impression.py (API /api/ping, /api/check…) ;\n  //  - servi par la passerelle de caisse ma-bridge.ps1 (API /api/health, /api/print).\n  const ONLINE = location.protocol === \'https:\';\n  const API = location.protocol === \'file:\' ? \'http://127.0.0.1:8642\' : \'\';\n  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === \'MacIntel\' && navigator.maxTouchPoints > 1);\n  const BRIDGE_CMD = \'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=\\\'Tls12\\\'; \'\n    + \'& ([scriptblock]::Create((New-Object Net.WebClient).DownloadString(\\\'https://mvtax.github.io/caisse/bridge.ps1\\\'))) \'\n    + \'-AppUrl \\\'https://mvtax.github.io/caisse/testeur/index.html\\\'"\';\n  const SERVER_HELP = IS_IOS\n    ? \'Sur iPhone : lancez la passerelle de caisse avec le testeur (commande ci-dessous), puis ouvrez <code>http://192.168.1.122:8080</code>.\'\n    : \'Double-cliquez sur <code>testeur-impression.py</code> (Python 3 nécessaire, python.org), \'\n      + \'ou lancez la passerelle de caisse avec le testeur, puis utilisez la page qui s\\\'ouvre.\';\n\n  let backend = null; // { kind: \'local\' | \'bridge\', info }\n  async function detectBackend() {\n    backend = null;\n    if (ONLINE) return null;\n    try {\n      const r = await api(\'/api/ping\', null, 3000);\n      if (r.ok && r.python) return (backend = { kind: \'local\', info: r });\n    } catch (e) { /* pas serveur.py */ }\n    if (location.protocol === \'http:\') {\n      try {\n        const r = await api(\'/api/health\', null, 15000);\n        if (r.ok && r.printer) return (backend = { kind: \'bridge\', info: r });\n      } catch (e) { /* pas la passerelle */ }\n    }\n    return null;\n  }\n\n  async function backendCheck(ip, port) {\n    if (backend.kind === \'local\') return api(\'/api/check\', { ip, port }, 30000);\n    const h = await api(`/api/health?ip=${encodeURIComponent(ip)}&port=${port}`, null, 20000);\n    const p = h.printer;\n    return {\n      ip: p.ip, port: p.port, bridge: true, status: null,\n      ping: { ok: null, detail: \'non testé par la passerelle\' },\n      ports: { [String(p.port)]: p.reachable ? { open: true, ms: p.latencyMs } : { open: false, err: p.error || \'injoignable\' } },\n    };\n  }\n\n  async function backendPrint(ip, port, bytes, label) {\n    if (backend.kind === \'local\') return api(\'/api/print\', { ip, port, data: toB64(bytes) });\n    const r = await api(\'/api/print\', {\n      data: toB64(bytes), copies: 1, label: \'Testeur : \' + label, printer: { ip, port },\n      jobId: \'testeur-\' + Date.now() + \'-\' + Math.random().toString(36).slice(2, 8),\n    }, 30000);\n    return { ok: true, sent: r.bytes, ip, port };\n  }\n\n  async function api(path, body, timeout = 20000) {\n    const ctrl = new AbortController();\n    const t = setTimeout(() => ctrl.abort(), timeout);\n    try {\n      const r = await fetch(API + path, body\n        ? { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify(body), signal: ctrl.signal }\n        : { signal: ctrl.signal });\n      const j = await r.json().catch(() => ({ error: `réponse inattendue (HTTP ${r.status})` }));\n      if (!r.ok) throw new Error(j.error || \'HTTP \' + r.status);\n      return j;\n    } catch (e) {\n      if (e.name === \'AbortError\') throw new Error(\'délai dépassé\');\n      if (e instanceof TypeError) throw new Error(\'serveur local injoignable\');\n      throw e;\n    } finally { clearTimeout(t); }\n  }\n\n  const esc = (s) => String(s ?? \'\').replace(/[&<>"]/g, (c) => ({ \'&\': \'&amp;\', \'<\': \'&lt;\', \'>\': \'&gt;\', \'"\': \'&quot;\' }[c]));\n  const ICONS = { ok: \'✅\', warn: \'⚠️\', err: \'❌\', info: \'ℹ️\', run: \'⏳\' };\n\n  // Ajoute une ligne de résultat. detail est du HTML déjà échappé.\n  function report(kind, title, detail = \'\', actions = []) {\n    const li = document.createElement(\'li\');\n    li.className = kind;\n    li.innerHTML = `<span class="i">${ICONS[kind]}</span><div><b>${esc(title)}</b>${detail ? `<div class="d">${detail}</div>` : \'\'}</div>`;\n    if (actions.length) {\n      const a = document.createElement(\'div\');\n      a.className = \'a\';\n      for (const [label, fn] of actions) {\n        const btn = document.createElement(\'button\');\n        btn.className = \'btn\'; btn.type = \'button\'; btn.textContent = label;\n        btn.addEventListener(\'click\', () => fn(btn));\n        a.appendChild(btn);\n      }\n      li.lastElementChild.appendChild(a);\n    }\n    $(\'#diagOut\').appendChild(li);\n    return li;\n  }\n  function pending(title) {\n    const li = report(\'run\', title);\n    return (kind, t, detail, actions) => { const n = report(kind, t, detail, actions); li.replaceWith(n); return n; };\n  }\n\n  function getIp() {\n    const ip = $(\'#ip\').value.trim();\n    try { localStorage.setItem(\'testeur.ip\', ip); localStorage.setItem(\'testeur.port\', $(\'#ipPort\').value); } catch (e) {}\n    return ip;\n  }\n  const getPort = () => parseInt($(\'#ipPort\').value, 10) || 9100;\n\n  function toB64(u8) {\n    let s = \'\';\n    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));\n    return btoa(s);\n  }\n\n  function netTestLines(ip, port) {\n    return [\n      { t: \'text\', s: \'TEST RESEAU OK\', align: \'center\', bold: true, big: true },\n      { t: \'sep\' },\n      { t: \'cols\', l: \'Imprimante\', r: `${ip}:${port}` },\n      { t: \'cols\', l: \'Date\', r: new Date().toLocaleString(\'fr-FR\') },\n      { t: \'text\', s: \'Accents : é è à ç ù € °\' },\n      { t: \'sep\' },\n      { t: \'text\', s: \'Si vous lisez ceci, la connexion fonctionne.\', align: \'center\' },\n    ];\n  }\n\n  async function sendToIp(bytes, label, btn) {\n    const ip = getIp(), port = getPort();\n    if (!ip) { report(\'warn\', \'Saisissez d\\\'abord l\\\'IP de l\\\'imprimante.\'); $(\'#ip\').focus(); return; }\n    if (btn) btn.disabled = true;\n    const done = pending(`${label} → ${ip}:${port}…`);\n    try {\n      if (!backend) await detectBackend();\n      if (!backend) throw new Error(ONLINE ? \'impossible depuis la version en ligne (voir l\\\'encadré ci-dessus)\' : \'serveur local injoignable\');\n      const r = await backendPrint(ip, port, bytes, label);\n      done(\'ok\', `${label} envoyé à ${r.ip}:${r.port}`, `${r.sent} octets transmis. Si rien ne sort : vérifiez le papier, le capot, ou essayez un autre jeu de caractères / le port 9100.`);\n    } catch (e) {\n      done(\'err\', `Échec de l\'envoi à ${ip}:${port}`, esc(e.message) + (/injoignable/.test(e.message) ? \'<br>\' + SERVER_HELP : \'\'));\n    } finally { if (btn) btn.disabled = false; }\n  }\n\n  async function runDiag() {\n    const out = $(\'#diagOut\');\n    out.replaceChildren();\n    $(\'#diagBtn\').disabled = true;\n    try {\n      // 1. Navigateur\n      const ua = navigator.userAgent;\n      const browser = /Edg\\//.test(ua) ? \'Edge\' : /Chrome\\//.test(ua) ? \'Chrome\' : /Firefox\\//.test(ua) ? \'Firefox\' : /Safari\\//.test(ua) ? \'Safari\' : \'navigateur inconnu\';\n      report(\'info\', `Navigateur : ${browser}`, `Page ouverte via <code>${esc(location.protocol.replace(\':\', \'\'))}</code>`\n        + ` · WebUSB ${navigator.usb ? \'oui\' : \'non\'} · port série ${navigator.serial ? \'oui\' : \'non\'}`);\n\n      // 2. Boîte d\'impression du navigateur\n      if (inFrame()) {\n        report(\'err\', \'Page affichée dans un aperçu intégré\', \'Dans ce cadre, le navigateur bloque l\\\'impression : le bouton Imprimer ne fait rien. \'\n          + \'Ouvrez <code>index.html</code> directement dans Chrome ou Edge, ou lancez <code>lancer.bat</code> / <code>lancer.sh</code>.\');\n      } else if (printState.clicked && !printState.opened) {\n        report(\'err\', \'La boîte d\\\'impression ne s\\\'est pas ouverte\', \'Le navigateur a refusé d\\\'afficher l\\\'impression. Essayez Ctrl+P, ou un autre navigateur.\');\n      } else if (printState.opened) {\n        report(\'ok\', \'La boîte d\\\'impression s\\\'ouvre bien\', \'Si rien ne sort ensuite, le problème vient de l\\\'imprimante choisie dans la boîte (voir ci-dessous).\');\n      } else {\n        report(\'info\', \'Boîte d\\\'impression pas encore testée\', \'\', [[\'Tester maintenant\', () => printBrowser()]]);\n      }\n\n      // 3. Accès au réseau local (serveur.py ou passerelle de caisse)\n      if (ONLINE) {\n        report(\'info\', \'Version en ligne : pas d\\\'accès à l\\\'imprimante réseau\',\n          \'Une page HTTPS ne peut pas joindre une imprimante du réseau local. Suivez l\\\'encadré ci-dessus pour tester depuis la passerelle de caisse.\'\n          + (IS_IOS ? \' Ici, le bouton Imprimer passe par AirPrint : seule une imprimante compatible AirPrint peut imprimer.\' : \'\'));\n        return;\n      }\n      let done = pending(\'Serveur local ou passerelle…\');\n      await detectBackend();\n      const server = backend && backend.kind === \'local\' ? backend.info : null;\n      if (server) {\n        done(\'ok\', \'Serveur local actif\', `${esc(server.os)} · Python ${esc(server.python)} · IP de ce poste : ${esc(server.local_ips.join(\', \') || \'?\')}`);\n      } else if (backend) {\n        const b = backend.info;\n        done(\'ok\', `Passerelle de caisse active (version ${b.version})`, `Imprimante configurée : ${esc(b.printer.ip)}:${esc(b.printer.port)}`\n          + (b.printer.reachable ? \' (joignable)\' : \' (injoignable)\'));\n        if (!$(\'#ip\').value.trim()) $(\'#ip\').value = b.printer.ip;\n      } else {\n        done(\'err\', \'Ni serveur local ni passerelle\', \'Sans eux, impossible de tester une IP ou d\\\'imprimer en réseau. \' + SERVER_HELP);\n      }\n\n      // 4. Imprimantes installées\n      if (server) {\n        done = pending(\'Imprimantes installées…\');\n        try {\n          const r = await api(\'/api/printers\');\n          if (!r.printers.length) {\n            done(\'warn\', \'Aucune imprimante installée sur ce poste\', (r.note ? esc(r.note) + \'<br>\' : \'\')\n              + \'Le bouton Imprimer du navigateur ne pourra produire qu\\\'un PDF. Installez le pilote de l\\\'imprimante, ou imprimez en direct sur son IP.\');\n          } else {\n            const li = done(\'ok\', `${r.printers.length} imprimante${r.printers.length > 1 ? \'s\' : \'\'} installée${r.printers.length > 1 ? \'s\' : \'\'}`,\n              r.printers.map((p) => `${esc(p.name)}${p.name === r.default ? \' <i>(par défaut)</i>\' : \'\'}`\n                + `${p.port ? \' · \' + esc(p.port) : \'\'}${p.status ? \' · \' + esc(p.status) : \'\'}`).join(\'<br>\'),\n              r.printers.map((p) => [`Page texte → ${p.name}`, async (btn) => {\n                btn.disabled = true;\n                const d = pending(`Impression d\'une page texte sur ${p.name}…`);\n                try {\n                  await api(\'/api/print-system\', { printer: p.name, text: `TEST D\'IMPRESSION\\n\\nImprimante : ${p.name}\\nDate : ${new Date().toLocaleString(\'fr-FR\')}\\n\\nSi vous lisez ceci, le pilote fonctionne.\\n` }, 40000);\n                  d(\'ok\', `Page texte envoyée à ${p.name}`, \'Envoyée par le système (sans passer par le navigateur).\');\n                } catch (e) { d(\'err\', `Échec sur ${p.name}`, esc(e.message)); }\n                btn.disabled = false;\n              }]));\n            // Repère les imprimantes réseau dans les ports installés\n            const ipsInPorts = r.printers.map((p) => (String(p.port).match(/\\b(\\d{1,3}(?:\\.\\d{1,3}){3})\\b/) || [])[1]).filter(Boolean);\n            if (ipsInPorts.length && !$(\'#ip\').value.trim()) {\n              report(\'info\', \'IP trouvée dans la configuration\', esc(ipsInPorts.join(\', \')),\n                ipsInPorts.map((ip) => [`Tester ${ip}`, () => { $(\'#ip\').value = ip; runDiag(); }]));\n            }\n            void li;\n          }\n        } catch (e) { done(\'err\', \'Liste des imprimantes illisible\', esc(e.message)); }\n      }\n\n      // 5. Imprimante réseau\n      const ip = getIp(), port = getPort();\n      if (!ip) {\n        report(\'info\', \'Aucune IP saisie\', \'Si l\\\'imprimante est en réseau (câble Ethernet ou Wi-Fi), saisissez son IP ou cliquez sur « Chercher les imprimantes réseau ». \'\n          + \'Astuce : sur la plupart des imprimantes ticket, maintenir le bouton FEED à l\\\'allumage imprime une page avec l\\\'IP.\');\n      } else if (!/^[a-z0-9.\\-]+$/i.test(ip)) {\n        report(\'err\', \'IP invalide\', `« ${esc(ip)} » : une IP ressemble à <code>192.168.1.50</code>.`);\n      } else if (backend) {\n        done = pending(`Test de ${ip}…`);\n        try {\n          const r = await backendCheck(ip, port);\n          done(\'info\', `Imprimante ${r.ip}`);\n          const p = r.ports[String(r.port)];\n          if (r.bridge) { /* la passerelle ne fait pas de ping */ }\n          else if (r.ping.ok === true) report(\'ok\', \'Répond au ping\', `${r.ping.ms} ms`);\n          else if (r.ping.ok === null) report(\'info\', \'Ping non disponible\', esc(r.ping.detail));\n          else report(p.open ? \'info\' : \'err\', p.open ? \'Ne répond pas au ping (normal pour certaines imprimantes)\' : \'Ne répond pas au ping\',\n            p.open ? \'\' : \'Vérifiez qu\\\'elle est allumée, branchée au réseau, et que l\\\'IP est la bonne.\');\n\n          const mine = ((server && server.local_ips) || []).map((x) => x.split(\'.\').slice(0, 3).join(\'.\'));\n          if (mine.length && /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(r.ip) && !r.ip.startsWith(\'127.\') && !mine.includes(r.ip.split(\'.\').slice(0, 3).join(\'.\'))) {\n            report(\'warn\', \'Pas sur le même réseau que ce poste\', `Ce poste : ${esc(server.local_ips.join(\', \'))} · imprimante : ${esc(r.ip)}. `\n              + \'Si la connexion échoue, changez l\\\'IP de l\\\'imprimante (ou du poste) pour qu\\\'elles commencent pareil.\');\n          }\n\n          if (p.open && r.bridge) report(\'ok\', `Imprimante joignable par la passerelle`, `${r.ip}:${r.port}, réponse en ${p.ms} ms.`);\n          else if (p.open) report(\'ok\', `Port ${r.port} ouvert`, `Connexion en ${p.ms} ms : l\'imprimante accepte les impressions directes.`);\n          else report(\'err\', `Port ${r.port} inaccessible`, esc(p.err) + \'. \' + (r.port === 9100 ? \'L\\\'impression brute (RAW / JetDirect) est peut-être désactivée, ou ce n\\\'est pas une imprimante.\' : \'Essayez le port 9100.\'));\n\n          const others = Object.entries(r.ports).filter(([k]) => +k !== r.port)\n            .map(([k, v]) => `${k} ${({ 9100: \'(RAW)\', 515: \'(LPD)\', 631: \'(IPP)\', 80: \'(web)\' })[k] || \'\'} : ${v.open ? \'ouvert\' : \'fermé\'}`);\n          if (others.length) report(\'info\', \'Autres ports\', esc(others.join(\' · \'))\n            + (r.ports[\'80\'] && r.ports[\'80\'].open ? ` — page de configuration : <a href="http://${esc(r.ip)}" target="_blank" rel="noopener">http://${esc(r.ip)}</a>` : \'\'));\n\n          if (r.status) {\n            if (!r.status.answered) report(\'info\', \'État papier/capot non communiqué\', \'L\\\'imprimante ne répond pas à la demande d\\\'état ESC/POS (fréquent, sans gravité).\');\n            else if (r.status.problems.length) report(\'err\', \'L\\\'imprimante signale un problème\', esc(r.status.problems.join(\', \')));\n            else report(\'ok\', \'Imprimante prête\', \'Papier présent, capot fermé, en ligne.\');\n          }\n\n          if (p.open) {\n            report(\'info\', \'Dernière étape : imprimer pour de vrai\', \'\', [\n              [\'🖨 Envoyer un ticket de test\', (btn) => sendToIp(escposBytes(netTestLines(r.ip, r.port)), \'Ticket de test\', btn)],\n              [\'Envoyer l\\\'aperçu actuel\', (btn) => sendToIp(escposBytes(), \'Aperçu\', btn)],\n            ]);\n          }\n        } catch (e) {\n          done(\'err\', `Test de ${ip} impossible`, esc(e.message));\n        }\n      } else {\n        report(\'warn\', `IP ${ip} non testée`, \'Démarrez d\\\'abord le serveur local ou la passerelle (voir plus haut).\');\n      }\n    } finally {\n      $(\'#diagBtn\').disabled = false;\n    }\n  }\n\n  async function runScan() {\n    $(\'#scanBtn\').disabled = true;\n    $(\'#diagOut\').replaceChildren();\n    const done = pending(`Recherche des imprimantes réseau (port ${getPort()})… environ 10 secondes`);\n    try {\n      if (!backend) await detectBackend();\n      if (!backend || backend.kind !== \'local\') {\n        throw new Error(backend ? \'la recherche n\\\'est possible qu\\\'avec testeur-impression.py (pas via la passerelle)\' : \'serveur local injoignable\');\n      }\n      const r = await api(\'/api/scan\', { port: getPort() }, 90000);\n      if (!r.found.length) {\n        done(\'warn\', \'Aucune imprimante trouvée\', `${r.scanned} adresses testées sur ${esc(r.networks.join(\', \') || \'aucun réseau\')}. `\n          + \'L\\\'imprimante est peut-être en USB, éteinte, ou sur un autre réseau.\');\n      } else {\n        done(\'ok\', `${r.found.length} appareil${r.found.length > 1 ? \'s\' : \'\'} avec le port ${getPort()} ouvert`,\n          r.found.map((f) => esc(f.ip) + (f.name ? ` · ${esc(f.name)}` : \'\')).join(\'<br>\'),\n          r.found.map((f) => [`Utiliser ${f.ip}`, () => { $(\'#ip\').value = f.ip; runDiag(); }]));\n      }\n    } catch (e) {\n      done(\'err\', \'Recherche impossible\', esc(e.message) + (/injoignable/.test(e.message) ? \'<br>\' + SERVER_HELP : \'\'));\n    } finally { $(\'#scanBtn\').disabled = false; }\n  }\n\n  // ---------- Événements ----------\n  $(\'#freeText\').value = [\n    \'# Bonjour !\',\n    \'^ Test d\\\'impression\',\n    \'---\',\n    \'Écrivez ce que vous voulez ici, l\\\'aperçu\',\n    \'se met à jour en direct.\',\n    \'\',\n    \'Café :: 1,80 €\',\n    \'Croissant :: 1,20 €\',\n    \'===\',\n    \'**TOTAL :: 3,00 €**\',\n    \'> Merci !\',\n  ].join(\'\\n\');\n\n  $$(\'.tab\').forEach((t) => t.addEventListener(\'click\', () => {\n    mode = t.dataset.mode;\n    $$(\'.tab\').forEach((x) => x.setAttribute(\'aria-selected\', String(x === t)));\n    $$(\'.pane\').forEach((p) => { p.hidden = p.dataset.pane !== mode; });\n    update();\n  }));\n\n  $(\'#paper\').addEventListener(\'change\', () => { $(\'#cols\').value = PAPERS[$(\'#paper\').value].cols; update(); });\n  $(\'#payment\').addEventListener(\'change\', () => { $(\'#givenField\').hidden = $(\'#payment\').value !== \'Espèces\'; update(); });\n  $(\'#addItem\').addEventListener(\'click\', () => {\n    const [name, price] = PRODUCTS[rnd(0, PRODUCTS.length - 1)];\n    items.push({ name, qty: 1, price });\n    renderItems(); update();\n  });\n  $(\'#randomTicket\').addEventListener(\'click\', () => {\n    const pool = [...PRODUCTS].sort(() => Math.random() - 0.5);\n    items = pool.slice(0, rnd(2, 7)).map(([name, price]) => ({ name, qty: Math.random() < 0.65 ? 1 : rnd(2, 4), price }));\n    ticketNo = rnd(1000, 99999);\n    const pays = $(\'#payment\').options;\n    $(\'#payment\').selectedIndex = rnd(0, pays.length - 1);\n    $(\'#givenField\').hidden = $(\'#payment\').value !== \'Espèces\';\n    renderItems(); update();\n  });\n\n  document.querySelectorAll(\'input, select, textarea\').forEach((el) => {\n    if (!el.closest(\'#items\')) el.addEventListener(\'input\', update);\n  });\n\n  $(\'#printBtn\').addEventListener(\'click\', printBrowser);\n  $(\'#printBtn2\').addEventListener(\'click\', printBrowser);\n  $(\'#connectUsb\').addEventListener(\'click\', connectUsb);\n  $(\'#connectSerial\').addEventListener(\'click\', connectSerial);\n  $(\'#rawPrint\').addEventListener(\'click\', () => send(escposBytes(), \'Ticket\'));\n  $(\'#drawer\').addEventListener(\'click\', () => send(new Uint8Array(DRAWER), \'Ouverture tiroir\'));\n  $(\'#download\').addEventListener(\'click\', download);\n  $(\'#diagBtn\').addEventListener(\'click\', runDiag);\n  $(\'#scanBtn\').addEventListener(\'click\', runScan);\n  $(\'#ipPrintBtn\').addEventListener(\'click\', (e) => { $(\'#diagOut\').replaceChildren(); sendToIp(escposBytes(), \'Impression\', e.currentTarget); });\n  $(\'#ip\').addEventListener(\'keydown\', (e) => { if (e.key === \'Enter\') runDiag(); });\n  // Adapter l\'interface au contexte\n  $(\'#bridgeCmd\').textContent = BRIDGE_CMD;\n  $(\'#copyCmd\').addEventListener(\'click\', async () => {\n    try { await navigator.clipboard.writeText(BRIDGE_CMD); $(\'#copyCmd\').textContent = \'Copiée ✓\'; }\n    catch (e) { const r = document.createRange(); r.selectNodeContents($(\'#bridgeCmd\')); getSelection().removeAllRanges(); getSelection().addRange(r); }\n  });\n  if (!navigator.usb) $(\'#connectUsb\').hidden = true;\n  if (!navigator.serial) { $(\'#connectSerial\').hidden = true; $(\'#baudField\').hidden = true; }\n  if (!navigator.usb && !navigator.serial) { $(\'#rawPrint\').hidden = true; $(\'#drawer\').hidden = true; $(\'#status\').hidden = true; }\n  if (ONLINE) {\n    $(\'#onlineBox\').hidden = false;\n    $(\'#ipRow\').hidden = true; $(\'#scanBtn\').hidden = true; $(\'#ipPrintBtn\').hidden = true;\n    if (!navigator.usb && !navigator.serial) $(\'#escposCard\').hidden = true;\n    if (IS_IOS) $(\'#printHelp\').textContent = \'Sur iPhone, Imprimer ouvre le partage AirPrint : seule une imprimante compatible AirPrint peut imprimer. Pour l\\\'imprimante ticket, voir Diagnostic.\';\n  } else {\n    detectBackend().then((b) => {\n      if (b && b.kind === \'bridge\') {\n        $(\'#scanBtn\').hidden = true;\n        if (!$(\'#ip\').value.trim()) $(\'#ip\').value = b.info.printer.ip;\n      }\n    });\n  }\n  try {\n    $(\'#ip\').value = localStorage.getItem(\'testeur.ip\') || \'\';\n    $(\'#ipPort\').value = localStorage.getItem(\'testeur.port\') || \'9100\';\n  } catch (e) {}\n  window.addEventListener(\'resize\', update);\n\n  renderItems();\n  update();\n})();\n</script>\n</body>\n</html>\n'


# ---------------------------------------------------------------- utilitaires

def resolve_private(host):
    """Résout un nom/IP et refuse tout ce qui n'est pas sur le réseau local."""
    host = (host or "").strip()
    if not host:
        raise ValueError("Adresse IP vide.")
    try:
        ip = socket.gethostbyname(host)
    except socket.gaierror:
        raise ValueError(f"Nom ou adresse introuvable : {host}")
    addr = ipaddress.ip_address(ip)
    if not (addr.is_private or addr.is_loopback or addr.is_link_local):
        raise ValueError(f"{ip} n'est pas une adresse du réseau local : refusé par sécurité.")
    return ip


def check_port(port):
    port = int(port)
    if not 1 <= port <= 65535:
        raise ValueError("Port invalide.")
    return port


def local_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # aucun paquet envoyé, sert à trouver l'interface
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith("127."))


def ping(ip):
    exe = shutil.which("ping")
    if not exe:
        return {"ok": None, "detail": "commande ping absente"}
    args = [exe, "-n", "1", "-w", "1500", ip] if IS_WIN else [exe, "-c", "1", "-W", "2", ip]
    t = time.time()
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=5)
    except (subprocess.TimeoutExpired, OSError) as e:
        return {"ok": False, "detail": str(e)}
    ms = round((time.time() - t) * 1000)
    out = (r.stdout or "") + (r.stderr or "")
    # Sous Windows, "Impossible de joindre l'hôte" renvoie parfois 0 : on vérifie TTL.
    ok = r.returncode == 0 and ("TTL" in out.upper() or not IS_WIN)
    if r.returncode != 0 and "permission" in out.lower():
        return {"ok": None, "detail": "ping non autorisé sur cette machine"}
    return {"ok": ok, "ms": ms, "detail": out.strip().splitlines()[-1] if out.strip() else ""}


def tcp_check(ip, port, timeout=2.0):
    t = time.time()
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return {"open": True, "ms": round((time.time() - t) * 1000)}
    except socket.timeout:
        return {"open": False, "err": "pas de réponse (délai dépassé)"}
    except ConnectionRefusedError:
        return {"open": False, "err": "connexion refusée (port fermé)"}
    except OSError as e:
        return {"open": False, "err": e.strerror or str(e)}


def escpos_status(ip, port):
    """Demande l'état temps réel (DLE EOT 1/2/4). Toutes les imprimantes ne répondent pas."""
    res = {"answered": False, "problems": [], "raw": []}
    try:
        with socket.create_connection((ip, port), timeout=2) as s:
            s.settimeout(1.5)
            for n in (1, 2, 4):
                s.sendall(bytes([0x10, 0x04, n]))
                try:
                    b = s.recv(1)
                except socket.timeout:
                    b = b""
                if not b:
                    continue
                res["answered"] = True
                v = b[0]
                res["raw"].append(f"{n}:{v:08b}")
                if n == 1 and v & 0x08:
                    res["problems"].append("imprimante hors ligne")
                if n == 2:
                    if v & 0x04: res["problems"].append("capot ouvert")
                    if v & 0x20: res["problems"].append("erreur imprimante")
                    if v & 0x08: res["problems"].append("bouton d'avance papier appuyé")
                if n == 4:
                    if v & 0x60: res["problems"].append("plus de papier")
                    elif v & 0x0C: res["problems"].append("papier presque fini")
    except OSError as e:
        res["error"] = e.strerror or str(e)
    return res


def send_raw(ip, port, data):
    with socket.create_connection((ip, port), timeout=4) as s:
        s.settimeout(10)
        s.sendall(data)
        try:
            s.shutdown(socket.SHUT_WR)
        except OSError:
            pass
        time.sleep(0.3)
    return len(data)


def scan(port, timeout=0.5):
    nets = set()
    for ip in local_ips():
        nets.add(ipaddress.ip_network(ip + "/24", strict=False))
    hosts = [str(h) for n in nets for h in n.hosts()]

    def probe(h):
        try:
            with socket.create_connection((h, port), timeout=timeout):
                return h
        except OSError:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=128) as ex:
        found = [h for h in ex.map(probe, hosts) if h]
    result = []
    for h in sorted(found, key=lambda x: tuple(int(p) for p in x.split("."))):
        try:
            name = socket.gethostbyaddr(h)[0]
        except OSError:
            name = ""
        result.append({"ip": h, "name": name})
    return {"networks": [str(n) for n in nets], "found": result, "scanned": len(hosts)}


def system_printers():
    printers, default = [], None
    try:
        if IS_WIN:
            ps = ("Get-Printer | Select-Object Name,PortName,DriverName,PrinterStatus,"
                  "@{n='Default';e={$_.Default}} | ConvertTo-Json -Compress")
            r = subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                               capture_output=True, text=True, timeout=15)
            data = json.loads(r.stdout or "[]")
            if isinstance(data, dict):
                data = [data]
            for p in data:
                printers.append({"name": p.get("Name"), "port": p.get("PortName"),
                                 "driver": p.get("DriverName"), "status": str(p.get("PrinterStatus"))})
            try:
                r = subprocess.run(["powershell", "-NoProfile", "-Command",
                                    "(Get-CimInstance Win32_Printer -Filter 'Default=True').Name"],
                                   capture_output=True, text=True, timeout=15)
                default = r.stdout.strip() or None
            except Exception:
                pass
        elif shutil.which("lpstat"):
            r = subprocess.run(["lpstat", "-p", "-d"], capture_output=True, text=True, timeout=10,
                               env={**os.environ, "LANG": "C", "LC_ALL": "C"})
            for line in r.stdout.splitlines():
                if line.startswith("printer "):
                    parts = line.split()
                    status = "désactivée" if "disabled" in line else ("occupée" if "now printing" in line else "prête")
                    printers.append({"name": parts[1], "status": status})
                elif "system default destination:" in line:
                    default = line.split(":", 1)[1].strip()
            r = subprocess.run(["lpstat", "-v"], capture_output=True, text=True, timeout=10,
                               env={**os.environ, "LANG": "C", "LC_ALL": "C"})
            uris = {}
            for line in r.stdout.splitlines():
                if line.startswith("device for "):
                    name, uri = line[len("device for "):].split(":", 1)
                    uris[name] = uri.strip()
            for p in printers:
                p["port"] = uris.get(p["name"], "")
        else:
            return {"printers": [], "default": None, "note": "Aucun système d'impression détecté (lpstat absent)."}
    except Exception as e:  # noqa: BLE001
        return {"printers": printers, "default": default, "note": f"Lecture impossible : {e}"}
    return {"printers": printers, "default": default}


def print_system_text(printer, text):
    names = [p["name"] for p in system_printers()["printers"]]
    if printer not in names:
        raise ValueError("Imprimante inconnue.")
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8-sig" if IS_WIN else "utf-8") as f:
        f.write(text)
        path = f.name
    try:
        if IS_WIN:
            cmd = ["powershell", "-NoProfile", "-Command",
                   "Get-Content -LiteralPath $args[0] | Out-Printer -Name $args[1]", path, printer]
        else:
            cmd = ["lp", "-d", printer, path]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout or "échec").strip())
        return (r.stdout or "").strip()
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


# ---------------------------------------------------------------- serveur HTTP

ALLOWED_ORIGINS = {"null", f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            sys.stderr.write("  %s\n" % (fmt % args))

    def cors(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Vary", "Origin")

    def origin_ok(self):
        origin = self.headers.get("Origin")
        return origin is None or origin in ALLOWED_ORIGINS

    def json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            if not self.origin_ok():
                return self.json(403, {"error": "Origine refusée."})
            return self.api("GET", {})
        if self.path.split("?")[0] not in ("/", "", "/index.html"):
            return self.send_error(404)
        if EMBEDDED_HTML is not None:
            body = EMBEDDED_HTML.encode("utf-8")
        else:
            try:
                with open(os.path.join(HERE, "index.html"), "rb") as f:
                    body = f.read()
            except OSError:
                return self.send_error(404, "index.html introuvable a cote de serveur.py")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.path.startswith("/api/") or not self.origin_ok():
            return self.json(403, {"error": "Refusé."})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(min(n, 5_000_000)) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self.json(400, {"error": "Requête invalide."})
        return self.api("POST", body)

    def api(self, method, b):
        route = self.path.split("?")[0]
        try:
            if route == "/api/ping":
                return self.json(200, {"ok": True, "version": VERSION, "os": f"{platform.system()} {platform.release()}",
                                       "python": platform.python_version(), "host": socket.gethostname(),
                                       "local_ips": local_ips()})
            if route == "/api/printers":
                return self.json(200, system_printers())
            if method != "POST":
                return self.json(405, {"error": "Méthode non autorisée."})
            if route == "/api/check":
                ip = resolve_private(b.get("ip"))
                port = check_port(b.get("port", 9100))
                ports = {}
                for p in sorted({port, 9100, 515, 631, 80}):
                    ports[str(p)] = tcp_check(ip, p, timeout=1.5)
                status = escpos_status(ip, port) if ports[str(port)]["open"] else None
                return self.json(200, {"ip": ip, "port": port, "ping": ping(ip), "ports": ports, "status": status})
            if route == "/api/print":
                ip = resolve_private(b.get("ip"))
                port = check_port(b.get("port", 9100))
                data = base64.b64decode(b.get("data") or "")
                if not data:
                    raise ValueError("Rien à imprimer.")
                sent = send_raw(ip, port, data)
                return self.json(200, {"ok": True, "sent": sent, "ip": ip, "port": port})
            if route == "/api/scan":
                return self.json(200, scan(check_port(b.get("port", 9100))))
            if route == "/api/print-system":
                out = print_system_text(str(b.get("printer") or ""), str(b.get("text") or ""))
                return self.json(200, {"ok": True, "detail": out})
            return self.json(404, {"error": "Route inconnue."})
        except ValueError as e:
            return self.json(400, {"error": str(e)})
        except OSError as e:
            return self.json(502, {"error": e.strerror or str(e)})
        except Exception as e:  # noqa: BLE001
            return self.json(500, {"error": str(e)})


def already_running(url):
    try:
        with urllib.request.urlopen(url + "api/ping", timeout=2) as r:
            return json.loads(r.read()).get("ok") is True
    except Exception:  # noqa: BLE001
        return False


def pause_if_double_clicked():
    # Double-clic sous Windows : la fenêtre se fermerait avant qu'on lise le message.
    if IS_WIN:
        try:
            input("\nAppuyez sur Entrée pour fermer…")
        except EOFError:
            pass


def main():
    url = f"http://127.0.0.1:{PORT}/"
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        if already_running(url):
            print(f"Le testeur tourne déjà : ouverture de {url}")
            if "--no-browser" not in sys.argv:
                webbrowser.open(url)
            return
        print(f"Impossible d'ouvrir le port {PORT} : {e}")
        print("Un autre programme l'utilise. Essayez : TESTEUR_PORT=8643 puis relancez.")
        pause_if_double_clicked()
        sys.exit(1)
    print(f"Testeur d'impression : {url}")
    print("Laissez cette fenêtre ouverte. Ctrl+C pour arrêter.")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt.")


if __name__ == "__main__":
    main()
