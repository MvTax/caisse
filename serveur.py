#!/usr/bin/env python3
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
EMBEDDED_HTML = None


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
