<#
  MA+ Bridge - passerelle d'impression de MA+ Commander (Mangos Juice Bar)
  ========================================================================

  CE QUE FAIT CE SCRIPT (uniquement tant que la fenetre est ouverte) :
    1. Telecharge en memoire la derniere version de l'app (GitHub Pages).
    2. Ouvre temporairement le port 8080 du pare-feu Windows (reseau local uniquement).
    3. Sert l'app aux iPhones de la boutique : http://<IP-de-la-caisse>:8080
    4. Relaie les tickets (octets ESC/POS prepares par l'app) vers l'imprimante
       CSI GIANT-100 (192.168.1.200, port 9100).

  CE QU'IL NE FAIT PAS :
    - Aucun fichier ecrit sur le disque, aucun service, aucune tache planifiee.
    - Rien ne reste installe : a l'arret, la regle du pare-feu est supprimee.

  POUR L'ARRETER : Ctrl+C dans cette fenetre (nettoie le pare-feu), puis fermer.
  Si la fenetre a ete fermee avec la croix, nettoyer a la main (cmd administrateur) :
    netsh advfirewall firewall delete rule name="MA+ Bridge (temporaire)"

  LANCEMENT (cmd en administrateur) :
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://mvtax.github.io/caisse/bridge.ps1'))"

  NOTE : ce fichier doit rester en ASCII pur (pas d'accent) : il est telecharge avec
  l'encodage par defaut de Windows. Un test automatique le verifie.
#>
[CmdletBinding()]
param(
  [int]$Port = 8080,
  [string]$PrinterIp = '192.168.1.200',
  [int]$PrinterPort = 9100,
  [string]$AppUrl = 'https://mvtax.github.io/caisse/index.html',
  [string]$Token = '',
  [switch]$SelfTest,
  [switch]$NoFirewall
)

$BridgeVersion = '1.0.0'
$RuleName = 'MA+ Bridge (temporaire)'
$MaxBody = 262144   # 256 Ko
$DedupeSeconds = 30

if ($env:MA_BRIDGE_SELFTEST -eq '1') { $SelfTest = $true }
# Auto-test : ports dedies, pour ne pas gener une passerelle deja lancee.
if ($SelfTest -and -not $PSBoundParameters.ContainsKey('Port')) { $Port = 18080 }

# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

function Write-Log([string]$Message, [string]$Color = 'Gray') {
  Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $Message) -ForegroundColor $Color
}

function Get-ErrorText($ErrorRecord) {
  $e = $ErrorRecord.Exception
  while ($e.InnerException) { $e = $e.InnerException }
  return $e.Message
}

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-LanIPv4 {
  $ips = @()
  foreach ($ni in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($ni.OperationalStatus -ne 'Up') { continue }
    if ($ni.NetworkInterfaceType -eq 'Loopback') { continue }
    foreach ($ua in $ni.GetIPProperties().UnicastAddresses) {
      if ($ua.Address.AddressFamily -eq 'InterNetwork') { $ips += $ua.Address.ToString() }
    }
  }
  # Le reseau de la boutique (192.168.1.x) d'abord.
  return @($ips | Sort-Object { if ($_ -like '192.168.1.*') { 0 } elseif ($_ -like '169.254.*') { 2 } else { 1 } })
}

function Test-ValidIPv4([string]$Ip) {
  return ($Ip -match '^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$') -and
    ([int]$Matches[1] -le 255) -and ([int]$Matches[2] -le 255) -and
    ([int]$Matches[3] -le 255) -and ([int]$Matches[4] -le 255)
}

# ---------------------------------------------------------------------------
# Imprimante (TCP brut, port 9100). Une connexion par ticket, jamais gardee ouverte :
# le logiciel de caisse utilise aussi cette imprimante.
# ---------------------------------------------------------------------------

function Connect-Printer([string]$Ip, [int]$PortNumber, [int]$TimeoutMs) {
  $client = New-Object Net.Sockets.TcpClient
  $ar = $client.BeginConnect($Ip, $PortNumber, $null, $null)
  if (-not $ar.AsyncWaitHandle.WaitOne($TimeoutMs)) {
    $client.Close()
    throw ('delai de connexion depasse (' + $TimeoutMs + ' ms)')
  }
  try { $client.EndConnect($ar) } catch { $client.Close(); throw (Get-ErrorText $_) }
  return $client
}

function Test-Printer([string]$Ip, [int]$PortNumber) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $c = Connect-Printer $Ip $PortNumber 1500
    $c.Close()
    return @{ reachable = $true; latencyMs = [int]$sw.ElapsedMilliseconds; error = $null }
  } catch {
    return @{ reachable = $false; latencyMs = $null; error = (Get-ErrorText $_) }
  }
}

function Send-ToPrinter([byte[]]$Bytes, [string]$Ip, [int]$PortNumber, [int]$Copies) {
  $lastError = ''
  for ($attempt = 1; $attempt -le 2; $attempt++) {
    $client = $null
    try {
      $client = Connect-Printer $Ip $PortNumber 3000
      $stream = $client.GetStream()
      $stream.WriteTimeout = 5000
      for ($i = 0; $i -lt $Copies; $i++) { $stream.Write($Bytes, 0, $Bytes.Length) }
      $stream.Flush()
      $client.Client.Shutdown([Net.Sockets.SocketShutdown]::Send)
      Start-Sleep -Milliseconds 150
      $client.Close()
      return @{ ok = $true; attempts = $attempt }
    } catch {
      $lastError = Get-ErrorText $_
      if ($client) { try { $client.Close() } catch {} }
      if ($attempt -lt 2) { Start-Sleep -Milliseconds 500 }
    }
  }
  return @{ ok = $false; error = $lastError }
}

# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

function Add-Cors($Ctx) {
  $res = $Ctx.Response
  $origin = $Ctx.Request.Headers['Origin']
  if ($origin) { $res.AddHeader('Access-Control-Allow-Origin', $origin); $res.AddHeader('Vary', 'Origin') }
  else { $res.AddHeader('Access-Control-Allow-Origin', '*') }
  $res.AddHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  $res.AddHeader('Access-Control-Allow-Headers', 'Content-Type, X-MA-Token')
  $res.AddHeader('Access-Control-Allow-Private-Network', 'true')
  $res.AddHeader('Access-Control-Max-Age', '600')
}

function Send-Bytes($Ctx, [int]$Status, [string]$ContentType, [byte[]]$Body) {
  $res = $Ctx.Response
  try {
    $res.StatusCode = $Status
    $res.ContentType = $ContentType
    $res.AddHeader('Cache-Control', 'no-store')
    Add-Cors $Ctx
    $res.ContentLength64 = $Body.Length
    if ($Body.Length -gt 0) { $res.OutputStream.Write($Body, 0, $Body.Length) }
  } catch {
  } finally {
    try { $res.Close() } catch {}
  }
}

function Send-Json($Ctx, [int]$Status, $Object) {
  $json = ConvertTo-Json -InputObject $Object -Compress -Depth 5
  Send-Bytes $Ctx $Status 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($json))
}

function Read-Body($Ctx) {
  $req = $Ctx.Request
  $stream = $req.InputStream
  $ms = New-Object IO.MemoryStream
  $buf = New-Object byte[] 8192
  $total = 0
  while (($n = $stream.Read($buf, 0, $buf.Length)) -gt 0) {
    $total += $n
    # Au-dela de la limite on continue de lire (pour repondre proprement) sans stocker.
    if ($total -le $MaxBody) { $ms.Write($buf, 0, $n) }
    if ($total -gt 8 * $MaxBody) { break }
  }
  if ($total -gt $MaxBody) { return $null }
  return [Text.Encoding]::UTF8.GetString($ms.ToArray())
}

$script:Jobs = @{}
$script:HealthCache = @{ key = ''; at = [datetime]::MinValue; result = $null }

function Get-PrinterTarget($IpValue, $PortValue) {
  $ip = $PrinterIp
  $pp = $PrinterPort
  if ($IpValue -and (Test-ValidIPv4 ([string]$IpValue))) { $ip = [string]$IpValue }
  $parsed = 0
  if ($PortValue -and [int]::TryParse([string]$PortValue, [ref]$parsed) -and $parsed -ge 1 -and $parsed -le 65535) { $pp = $parsed }
  return @{ ip = $ip; port = $pp }
}

function Invoke-Health($Ctx) {
  $t = Get-PrinterTarget $Ctx.Request.QueryString['ip'] $Ctx.Request.QueryString['port']
  $key = $t.ip + ':' + $t.port
  $now = Get-Date
  # Cache de 15 s : on evite d'ouvrir le port de l'imprimante a chaque interrogation.
  if ($script:HealthCache.key -ne $key -or ($now - $script:HealthCache.at).TotalSeconds -gt 15) {
    $script:HealthCache = @{ key = $key; at = $now; result = (Test-Printer $t.ip $t.port) }
  }
  $r = $script:HealthCache.result
  Send-Json $Ctx 200 ([ordered]@{
      ok        = $true
      version   = $BridgeVersion
      printer   = [ordered]@{ ip = $t.ip; port = $t.port; reachable = $r.reachable; latencyMs = $r.latencyMs; error = $r.error }
      uptimeSec = [int]((Get-Date) - $script:StartTime).TotalSeconds
      app       = $script:AppSource
    })
}

function Invoke-Print($Ctx) {
  if ($Token -and $Ctx.Request.Headers['X-MA-Token'] -ne $Token) {
    Write-Log 'Requete refusee : jeton X-MA-Token invalide' 'Yellow'
    Send-Json $Ctx 401 @{ ok = $false; code = 'token'; error = 'jeton invalide' }
    return
  }
  $text = Read-Body $Ctx
  if ($null -eq $text) {
    Send-Json $Ctx 413 @{ ok = $false; code = 'too-large'; error = 'requete trop grosse (256 Ko max)' }
    return
  }
  try { $payload = ConvertFrom-Json -InputObject $text } catch { $payload = $null }
  if (-not $payload -or -not $payload.data) {
    Send-Json $Ctx 400 @{ ok = $false; code = 'bad-request'; error = 'JSON invalide ou champ data manquant' }
    return
  }
  try { $bytes = [Convert]::FromBase64String([string]$payload.data) } catch {
    Send-Json $Ctx 400 @{ ok = $false; code = 'bad-request'; error = 'data n est pas du base64' }
    return
  }
  $copies = 1
  if ($payload.copies) { $copies = [Math]::Min(3, [Math]::Max(1, [int]$payload.copies)) }
  $jobId = [string]$payload.jobId
  $label = 'Ticket'
  if ($payload.label) { $label = [string]$payload.label }
  $ip = $null; $pp = $null
  if ($payload.printer) { $ip = $payload.printer.ip; $pp = $payload.printer.port }
  $t = Get-PrinterTarget $ip $pp

  # Idempotence : meme jobId deja imprime il y a moins de 30 s -> on ne reimprime pas.
  $now = Get-Date
  foreach ($k in @($script:Jobs.Keys)) {
    if (($now - $script:Jobs[$k]).TotalSeconds -gt $DedupeSeconds) { $script:Jobs.Remove($k) }
  }
  if ($jobId -and $script:Jobs.ContainsKey($jobId)) {
    Write-Log ('= ' + $label + ' deja imprime (doublon ignore)') 'DarkGray'
    Send-Json $Ctx 200 @{ ok = $true; duplicate = $true; bytes = 0; ms = 0 }
    return
  }

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $r = Send-ToPrinter $bytes $t.ip $t.port $copies
  $ms = [int]$sw.ElapsedMilliseconds
  if ($r.ok) {
    if ($jobId) { $script:Jobs[$jobId] = Get-Date }
    $script:HealthCache.at = [datetime]::MinValue
    $suffix = ''
    if ($copies -gt 1) { $suffix = ', ' + $copies + ' exemplaires' }
    Write-Log ('[OK] ' + $label + ' imprime (' + $bytes.Length + ' octets, ' + $ms + ' ms' + $suffix + ')') 'Green'
    Send-Json $Ctx 200 @{ ok = $true; bytes = $bytes.Length; ms = $ms }
  } else {
    Write-Log ('[X] ' + $label + ' : imprimante injoignable (' + $t.ip + ':' + $t.port + ') - ' + $r.error + ' - verifier cable/alimentation/papier') 'Red'
    Send-Json $Ctx 502 @{ ok = $false; code = 'printer'; error = $r.error }
  }
}

function Invoke-Request($Ctx) {
  $req = $Ctx.Request
  $path = $req.Url.AbsolutePath
  $method = $req.HttpMethod
  try {
    if ($method -eq 'OPTIONS') { Send-Bytes $Ctx 204 'text/plain' ([byte[]]@()); return }
    if ($method -eq 'GET' -and ($path -eq '/' -or $path -eq '/index.html')) {
      $client = [string]$req.RemoteEndPoint.Address
      Send-Bytes $Ctx 200 'text/html; charset=utf-8' $script:AppBytes
      Write-Log ('App envoyee a ' + $client) 'DarkGray'
      return
    }
    if ($method -eq 'GET' -and $path -eq '/api/health') { Invoke-Health $Ctx; return }
    if ($method -eq 'POST' -and $path -eq '/api/print') { Invoke-Print $Ctx; return }
    Send-Json $Ctx 404 @{ ok = $false; code = 'not-found'; error = ('route inconnue : ' + $method + ' ' + $path) }
  } catch {
    Write-Log ('Erreur interne : ' + (Get-ErrorText $_)) 'Red'
    Send-Json $Ctx 500 @{ ok = $false; code = 'internal'; error = (Get-ErrorText $_) }
  }
}

# ---------------------------------------------------------------------------
# Pare-feu (regle temporaire, reseau local uniquement)
# ---------------------------------------------------------------------------

function Remove-FirewallRule {
  $removed = $false
  try {
    $existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
    if ($existing) { $existing | Remove-NetFirewallRule -ErrorAction Stop; $removed = $true }
  } catch {
    & netsh advfirewall firewall delete rule name="$RuleName" | Out-Null
    $removed = ($LASTEXITCODE -eq 0)
  }
  return $removed
}

function Add-FirewallRule {
  [void](Remove-FirewallRule)
  try {
    # Tous profils (le reseau de la boutique peut etre classe Public) MAIS uniquement
    # les appareils du sous-reseau local.
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Protocol TCP -LocalPort $Port `
      -Action Allow -Profile Any -RemoteAddress LocalSubnet -ErrorAction Stop | Out-Null
    return $true
  } catch {
    & netsh advfirewall firewall add rule name="$RuleName" dir=in action=allow protocol=TCP localport=$Port remoteip=localsubnet | Out-Null
    return ($LASTEXITCODE -eq 0)
  }
}

# ---------------------------------------------------------------------------
# Page de secours (pas d'Internet)
# ---------------------------------------------------------------------------

function Get-FallbackHtml([string]$Reason) {
  return @"
<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MA+ Bridge</title>
<style>body{font-family:-apple-system,sans-serif;background:#f7f3ee;color:#2d2d2d;padding:24px;line-height:1.5}
h1{color:#00879c}code{background:#fff;padding:2px 6px;border-radius:6px}</style></head>
<body><h1>MA+ Bridge fonctionne</h1>
<p>Mais l'application n'a pas pu etre telechargee depuis Internet au demarrage :</p>
<p><code>$Reason</code></p>
<p>Verifie la connexion Internet de la caisse, puis relance la passerelle (Ctrl+C puis la commande du matin).</p>
<p>L'impression reste disponible : <a href="/api/health">etat de l'imprimante</a>.</p>
</body></html>
"@
}

# ---------------------------------------------------------------------------
# Auto-test (CI Windows) : fausse imprimante + client HTTP dans des runspaces.
# ---------------------------------------------------------------------------

$FakePrinterScript = {
  param($PortNumber, $Sync)
  $l = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $PortNumber)
  $l.Start()
  $Sync.PrinterReady = $true
  $deadline = (Get-Date).AddSeconds(90)
  while (-not $Sync.StopPrinter -and (Get-Date) -lt $deadline) {
    if (-not $l.Pending()) { Start-Sleep -Milliseconds 30; continue }
    $c = $l.AcceptTcpClient()
    $s = $c.GetStream()
    $s.ReadTimeout = 3000
    $ms = New-Object IO.MemoryStream
    $buf = New-Object byte[] 4096
    try { while (($n = $s.Read($buf, 0, $buf.Length)) -gt 0) { $ms.Write($buf, 0, $n) } } catch {}
    $c.Close()
    [void]$Sync.Received.Add($ms.ToArray())
  }
  $l.Stop()
  $Sync.PrinterStopped = $true
}

$TestClientScript = {
  param($HttpPort, $Sync)
  $base = 'http://localhost:' + $HttpPort
  # Attention : un parametre [string] transforme $null en '' ; d'ou $Body non type.
  function Req([string]$Method, [string]$Path, $Body, [hashtable]$Headers) {
    $r = [Net.HttpWebRequest]::Create($base + $Path)
    $r.Method = $Method
    $r.Timeout = 15000
    if ($Headers) { foreach ($k in $Headers.Keys) { $r.Headers.Add($k, $Headers[$k]) } }
    if ($Body) {
      $b = [Text.Encoding]::UTF8.GetBytes([string]$Body)
      $r.ContentType = 'text/plain;charset=UTF-8'
      $r.ContentLength = $b.Length
      $st = $r.GetRequestStream(); $st.Write($b, 0, $b.Length); $st.Close()
    }
    try { $resp = $r.GetResponse() } catch [Net.WebException] {
      $resp = $_.Exception.Response
      if (-not $resp) { return @{ code = -1; body = $_.Exception.Message; headers = $null } }
    }
    $sr = New-Object IO.StreamReader($resp.GetResponseStream())
    $txt = $sr.ReadToEnd(); $sr.Close()
    $out = @{ code = [int]$resp.StatusCode; body = $txt; headers = $resp.Headers }
    $resp.Close()
    return $out
  }
  function Check([string]$Name, [bool]$Cond, [string]$Detail) {
    if ($Cond) { [void]$Sync.Results.Add('PASS ' + $Name) } else { [void]$Sync.Results.Add('FAIL ' + $Name + ' :: ' + $Detail) }
  }
  try {
    $deadline = (Get-Date).AddSeconds(30)
    while (-not $Sync.PrinterReady -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 50 }
    $h = $null
    while ((Get-Date) -lt $deadline) {
      $h = Req 'GET' ('/api/health?ip=127.0.0.1&port=' + $Sync.PrinterPort) $null $null
      if ($h.code -eq 200) { break }
      Start-Sleep -Milliseconds 200
    }
    $hj = $h.body | ConvertFrom-Json
    Check 'health 200' ($h.code -eq 200) $h.body
    Check 'health printer reachable' ($hj.printer.reachable -eq $true) $h.body
    Check 'health version' ([string]$hj.version -ne '') $h.body

    $page = Req 'GET' '/' $null $null
    Check 'GET / html' (($page.code -eq 200) -and ($page.body -match '<html')) ('code ' + $page.code)

    $opt = Req 'OPTIONS' '/api/print' $null @{ Origin = 'http://localhost:5173' }
    Check 'OPTIONS 204' ($opt.code -eq 204) ('code ' + $opt.code)
    Check 'CORS private network' ($opt.headers['Access-Control-Allow-Private-Network'] -eq 'true') 'header manquant'
    Check 'CORS origin' ($opt.headers['Access-Control-Allow-Origin'] -eq 'http://localhost:5173') 'origin'

    $data = [Convert]::ToBase64String($Sync.Sample)
    $target = '"printer":{"ip":"127.0.0.1","port":' + $Sync.PrinterPort + '}'
    $p1 = Req 'POST' '/api/print' ('{"data":"' + $data + '","copies":1,"jobId":"job-1","label":"Commande #1",' + $target + '}') $null
    $p1j = $p1.body | ConvertFrom-Json
    Check 'print ok' (($p1.code -eq 200) -and $p1j.ok -and ($p1j.bytes -eq $Sync.Sample.Length)) $p1.body

    $p2 = Req 'POST' '/api/print' ('{"data":"' + $data + '","copies":1,"jobId":"job-1",' + $target + '}') $null
    Check 'print doublon ignore' (($p2.body | ConvertFrom-Json).duplicate -eq $true) $p2.body

    $p3 = Req 'POST' '/api/print' ('{"data":"' + $data + '","copies":2,"jobId":"job-2",' + $target + '}') $null
    Check 'print 2 exemplaires' (($p3.body | ConvertFrom-Json).ok -eq $true) $p3.body

    $bad = Req 'POST' '/api/print' '{pas du json' $null
    Check 'JSON invalide 400' ($bad.code -eq 400) ('code ' + $bad.code)

    $big = Req 'POST' '/api/print' ('{"data":"' + ('A' * 300000) + '"}') $null
    Check 'trop gros 413' ($big.code -eq 413) ('code ' + $big.code + ' ' + $big.body)

    $nf = Req 'GET' '/nope' $null $null
    Check '404' ($nf.code -eq 404) ('code ' + $nf.code)

    # Imprimante eteinte -> erreur claire, en moins de 5 s.
    $Sync.StopPrinter = $true
    $deadline = (Get-Date).AddSeconds(5)
    while (-not $Sync.PrinterStopped -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 50 }
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $p4 = Req 'POST' '/api/print' ('{"data":"' + $data + '","jobId":"job-3",' + $target + '}') $null
    $p4j = $p4.body | ConvertFrom-Json
    Check 'imprimante eteinte 502' (($p4.code -eq 502) -and ($p4j.code -eq 'printer')) $p4.body
    Check 'imprimante eteinte rapide' ($sw.ElapsedMilliseconds -lt 8000) ('' + $sw.ElapsedMilliseconds + ' ms')
  } catch {
    [void]$Sync.Results.Add('FAIL exception client :: ' + $_.Exception.Message)
  } finally {
    $Sync.Done = $true
  }
}

# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------

function Invoke-MABridge {
  $script:StartTime = Get-Date
  try { $Host.UI.RawUI.WindowTitle = 'MA+ Bridge - ne pas fermer pendant le service' } catch {}

  Write-Host ''
  Write-Host '  ==============================================' -ForegroundColor Cyan
  Write-Host ('   MA+ Bridge ' + $BridgeVersion + ' - passerelle d impression') -ForegroundColor Cyan
  Write-Host '  ==============================================' -ForegroundColor Cyan
  Write-Host ''

  $isAdmin = Test-IsAdmin
  $sync = $null
  $runspaces = @()
  $prefix = 'http://+:' + $Port + '/'

  if ($SelfTest) {
    Write-Log 'MODE AUTO-TEST' 'Magenta'
    $prefix = 'http://localhost:' + $Port + '/'
    $sync = [hashtable]::Synchronized(@{
        PrinterReady = $false; StopPrinter = $false; PrinterStopped = $false; Done = $false
        PrinterPort = 19100
        Received = [Collections.ArrayList]::Synchronized((New-Object Collections.ArrayList))
        Results = [Collections.ArrayList]::Synchronized((New-Object Collections.ArrayList))
        Sample = [byte[]](0x1B, 0x40, 0x1B, 0x74, 0x13, 0x54, 0x45, 0x53, 0x54, 0x20, 0xD5, 0x0A, 0x1D, 0x56, 0x42, 0x00)
      })
    foreach ($pair in @(@($FakePrinterScript, 19100), @($TestClientScript, $Port))) {
      $ps = [PowerShell]::Create()
      [void]$ps.AddScript($pair[0]).AddArgument($pair[1]).AddArgument($sync)
      $runspaces += @{ ps = $ps; handle = $ps.BeginInvoke() }
    }
  } elseif (-not $isAdmin) {
    Write-Log 'Droits administrateur manquants.' 'Red'
    Write-Host ''
    Write-Host '  Ferme cette fenetre, puis : touche Windows, tape cmd,' -ForegroundColor Yellow
    Write-Host '  clic droit sur "Invite de commandes" -> "Executer en tant qu administrateur",' -ForegroundColor Yellow
    Write-Host '  et colle de nouveau la commande.' -ForegroundColor Yellow
    Write-Host ''
    return 1
  }

  # TLS 1.2 (GitHub l'exige ; Windows 10 1607 ne l'active pas toujours par defaut).
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

  # 1. Telechargement de l'app en memoire.
  Write-Log ('Telechargement de l app : ' + $AppUrl)
  try {
    $wc = New-Object Net.WebClient
    $wc.Encoding = [Text.Encoding]::UTF8
    $wc.Headers.Add('Cache-Control', 'no-cache')
    $html = $wc.DownloadString($AppUrl + '?t=' + [DateTime]::UtcNow.Ticks)
    if ($html -notmatch '<html') { throw 'contenu inattendu' }
    $script:AppBytes = [Text.Encoding]::UTF8.GetBytes($html)
    $script:AppSource = 'github-pages'
    Write-Log ('[OK] App chargee (' + [int]($script:AppBytes.Length / 1024) + ' Ko)') 'Green'
  } catch {
    $reason = Get-ErrorText $_
    $script:AppBytes = [Text.Encoding]::UTF8.GetBytes((Get-FallbackHtml $reason))
    $script:AppSource = 'fallback'
    Write-Log ('[X] App non telechargee (' + $reason + '). Page de secours servie.') 'Yellow'
  }

  # 2. Pare-feu.
  $firewallAdded = $false
  if (-not $NoFirewall -and $isAdmin) {
    $firewallAdded = Add-FirewallRule
    if ($firewallAdded) { Write-Log ('[OK] Pare-feu : port ' + $Port + ' ouvert pour le reseau local (temporaire)') 'Green' }
    else { Write-Log '[X] Impossible d ouvrir le pare-feu : les iPhones risquent de ne pas joindre la caisse.' 'Yellow' }
  }

  $listener = New-Object Net.HttpListener
  $listener.Prefixes.Add($prefix)
  $exitCode = 0
  try {
    # 3. Serveur HTTP.
    try { $listener.Start() } catch {
      $msg = Get-ErrorText $_
      Write-Log ('[X] Impossible d ecouter sur le port ' + $Port + ' : ' + $msg) 'Red'
      Write-Log '    Le port est peut-etre deja utilise (une autre fenetre MA+ Bridge est-elle ouverte ?).' 'Yellow'
      return 1
    }

    # 4. Imprimante.
    $testIp = $PrinterIp; $testPort = $PrinterPort
    if ($SelfTest) { $testIp = '127.0.0.1'; $testPort = 19100; Start-Sleep -Milliseconds 300 }
    $t = Test-Printer $testIp $testPort
    if ($t.reachable) { Write-Log ('[OK] Imprimante OK (' + $testIp + ':' + $testPort + ', ' + $t.latencyMs + ' ms)') 'Green' }
    else { Write-Log ('[X] Imprimante injoignable (' + $testIp + ':' + $testPort + ') : ' + $t.error + ' - verifier cable/alimentation') 'Red' }

    # 5. Adresse a ouvrir sur l'iPhone.
    $ips = Get-LanIPv4
    Write-Host ''
    Write-Host '  +--------------------------------------------------+' -ForegroundColor Green
    Write-Host '  |  Sur l iPhone (meme Wi-Fi), ouvrir dans Safari : |' -ForegroundColor Green
    foreach ($ip in $ips) {
      $url = 'http://' + $ip + ':' + $Port
      Write-Host ('  |      ' + $url.PadRight(44) + '|') -ForegroundColor White -BackgroundColor DarkGreen
    }
    if (-not $ips.Count) { Write-Host '  |  (aucune adresse reseau trouvee : taper ipconfig) |' -ForegroundColor Yellow }
    Write-Host '  +--------------------------------------------------+' -ForegroundColor Green
    Write-Host ''
    Write-Host '  Laisse cette fenetre ouverte pendant le service.' -ForegroundColor Cyan
    Write-Host '  Le soir : Ctrl+C ici (nettoie le pare-feu), puis fermer la fenetre.' -ForegroundColor Cyan
    Write-Host ('  Si la fenetre a ete fermee par la croix : netsh advfirewall firewall delete rule name="' + $RuleName + '"') -ForegroundColor DarkGray
    Write-Host ''
    Write-Log 'En attente des tickets...' 'Cyan'

    # 6. Boucle non bloquante : Ctrl+C reste possible.
    $deadline = (Get-Date).AddSeconds(120)
    while ($listener.IsListening) {
      $ar = $listener.BeginGetContext($null, $null)
      while (-not $ar.AsyncWaitHandle.WaitOne(250)) {
        if ($SelfTest -and ($sync.Done -or (Get-Date) -gt $deadline)) { break }
      }
      if ($ar.IsCompleted) {
        $ctx = $null
        try { $ctx = $listener.EndGetContext($ar) } catch {}
        if ($ctx) { Invoke-Request $ctx }
      }
      if ($SelfTest -and ($sync.Done -or (Get-Date) -gt $deadline)) { break }
    }
  } finally {
    try { $listener.Stop(); $listener.Close() } catch {}
    if ($firewallAdded) {
      if (Remove-FirewallRule) { Write-Log '[OK] Regle pare-feu supprimee. Rien ne reste sur la caisse.' 'Green' }
      else { Write-Log ('[X] Regle pare-feu non supprimee : netsh advfirewall firewall delete rule name="' + $RuleName + '"') 'Yellow' }
    }
    Write-Log 'MA+ Bridge arrete.' 'Cyan'
  }

  if ($SelfTest) {
    $sync.StopPrinter = $true
    foreach ($r in $runspaces) { try { [void]$r.ps.EndInvoke($r.handle) } catch {}; $r.ps.Dispose() }
    $results = @($sync.Results)
    # Verification des octets recus par la fausse imprimante.
    $chunks = @($sync.Received | Where-Object { $_.Length -gt 0 })
    $sample = $sync.Sample
    $hex = { param($b) ($b | ForEach-Object { $_.ToString('x2') }) -join ' ' }
    $expected1 = & $hex $sample
    $expected2 = & $hex ([byte[]]($sample + $sample))
    if ($chunks.Count -eq 2 -and (& $hex $chunks[0]) -eq $expected1 -and (& $hex $chunks[1]) -eq $expected2) {
      $results += 'PASS octets recus par l imprimante (1 ticket + 2 exemplaires, doublon ignore)'
    } else {
      $got = ($chunks | ForEach-Object { & $hex $_ }) -join ' | '
      $results += ('FAIL octets recus :: attendu [' + $expected1 + '] puis [' + $expected2 + '], recu ' + $chunks.Count + ' : ' + $got)
    }
    if ($firewallAdded) {
      $left = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
      if ($left) { $results += 'FAIL regle pare-feu encore presente' } else { $results += 'PASS regle pare-feu ajoutee puis supprimee' }
    }
    if (-not $sync.Done) { $results += 'FAIL le client de test n a pas termine (delai)' }
    Write-Host ''
    foreach ($line in $results) {
      if ($line -like 'PASS*') { Write-Host ('  ' + $line) -ForegroundColor Green } else { Write-Host ('  ' + $line) -ForegroundColor Red }
    }
    $failed = @($results | Where-Object { $_ -like 'FAIL*' }).Count
    Write-Host ''
    if ($failed -eq 0 -and $results.Count -gt 0) { Write-Host ('  AUTO-TEST OK (' + $results.Count + ' verifications)') -ForegroundColor Green; $exitCode = 0 }
    else { Write-Host ('  AUTO-TEST EN ECHEC (' + $failed + ' erreurs)') -ForegroundColor Red; $exitCode = 1 }
  }
  return $exitCode
}

$code = Invoke-MABridge
if ($SelfTest) { exit $code }
