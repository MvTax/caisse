@echo off
REM ============================================================
REM  MA+ Bridge — Passerelle d'impression CSI GIANT-100
REM  Lance un mini serveur HTTP sur la caisse qui reçoit les
REM  tickets de l'iPhone et les envoie à l'imprimante en TCP brut.
REM
REM  IP imprimante : 192.168.1.200 (port 9100)
REM  IP caisse     : 192.168.1.122
REM  Port serveur  : 8080
REM
REM  Utilisation : Double-clique sur ce fichier. Laisse la fenêtre
REM  ouverte (tu peux la réduire). C'est tout.
REM ============================================================

title MA+ Bridge - Passerelle d'impression
color 0B
mode con: cols=80 lines=25

REM Recherche PowerShell
where powershell >nul 2>&1
if errorlevel 1 (
    echo PowerShell introuvable. Impossible de continuer.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo    MA+ BRIDGE - Passerelle d'impression CSI GIANT-100
echo  ============================================================
echo.
echo    Serveur     : http://192.168.1.122:8080
echo    Imprimante  : 192.168.1.200:9100
echo.
echo    Statut      : Demarrage...
echo.
echo  ============================================================
echo    Laisse cette fenetre ouverte. Ferme-la pour arreter.
echo  ============================================================
echo.

REM Lance PowerShell embarqué qui gère le serveur HTTP
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference='Stop';" ^
"$printerIP='192.168.1.200';" ^
"$printerPort=9100;" ^
"$serverPort=8080;" ^
"$listener=New-Object System.Net.HttpListener;" ^
"$listener.Prefixes.Add(\"http://+:$serverPort/\");" ^
"try { $listener.Start() } catch { Write-Host '[ERREUR] Impossible de demarrer le serveur. Lance ce fichier en tant qu''administrateur.' -ForegroundColor Red; Write-Host ''; Write-Host 'Clic droit sur le .bat => Executer en tant qu''administrateur' -ForegroundColor Yellow; Read-Host 'Appuie sur Entree pour quitter'; exit 1 };" ^
"Write-Host '[OK] Serveur demarre sur le port' $serverPort -ForegroundColor Green;" ^
"Write-Host '[OK] Imprimante cible :' $printerIP':'$printerPort -ForegroundColor Green;" ^
"Write-Host '';" ^
"Write-Host 'En attente de tickets...' -ForegroundColor Cyan;" ^
"Write-Host '';" ^
"function Send-ToPrinter($data) {" ^
"  try {" ^
"    $client = New-Object System.Net.Sockets.TcpClient;" ^
"    $client.ReceiveTimeout = 3000;" ^
"    $client.SendTimeout = 3000;" ^
"    $client.Connect($printerIP, $printerPort);" ^
"    $stream = $client.GetStream();" ^
"    $bytes = [System.Text.Encoding]::GetEncoding(858).GetBytes($data);" ^
"    $stream.Write($bytes, 0, $bytes.Length);" ^
"    $stream.Flush();" ^
"    Start-Sleep -Milliseconds 200;" ^
"    $stream.Close();" ^
"    $client.Close();" ^
"    return $true;" ^
"  } catch {" ^
"    Write-Host ('[ERREUR IMPRIMANTE] ' + $_.Exception.Message) -ForegroundColor Red;" ^
"    return $false;" ^
"  }" ^
"}" ^
"function Build-Receipt($json) {" ^
"  $ESC = [char]27; $GS = [char]29; $LF = [char]10;" ^
"  $r = '';" ^
"  $r += $ESC + '@';" ^
"  $r += $ESC + 'a' + [char]1;" ^
"  $r += $GS + '!' + [char]17;" ^
"  $r += 'MA+' + $LF;" ^
"  $r += $GS + '!' + [char]0;" ^
"  $r += $ESC + 'a' + [char]1;" ^
"  $r += 'COMMANDE' + $LF;" ^
"  $r += '================================' + $LF;" ^
"  if ($json.bipper) {" ^
"    $r += $ESC + 'a' + [char]1;" ^
"    $r += $GS + '!' + [char]49;" ^
"    $r += '#' + $json.bipper + $LF;" ^
"    $r += $GS + '!' + [char]0;" ^
"  }" ^
"  $r += '--------------------------------' + $LF;" ^
"  $r += $ESC + 'a' + [char]0;" ^
"  foreach ($it in $json.items) {" ^
"    $name = $it.item;" ^
"    $size = if ($it.size -and $it.size -ne '-') { $it.size } else { '' };" ^
"    $price = if ($it.price) { $it.price } else { '' };" ^
"    $line = $name;" ^
"    if ($size) { $line += ' ' + $size }" ^
"    $padding = 42 - $line.Length - $price.Length;" ^
"    if ($padding -lt 1) { $padding = 1 }" ^
"    $r += $line + (' ' * $padding) + $price + $LF;" ^
"    if ($it.catLabel) { $r += '  ' + $it.catLabel + $LF }" ^
"    if ($it.service) { $r += '  >> ' + $it.service + ' <<' + $LF }" ^
"  }" ^
"  $r += '--------------------------------' + $LF;" ^
"  if ($json.total) {" ^
"    $r += $GS + '!' + [char]17;" ^
"    $totalLine = 'TOTAL';" ^
"    $padTotal = 21 - $totalLine.Length - $json.total.Length;" ^
"    if ($padTotal -lt 1) { $padTotal = 1 }" ^
"    $r += $totalLine + (' ' * $padTotal) + $json.total + $LF;" ^
"    $r += $GS + '!' + [char]0;" ^
"  }" ^
"  if ($json.payment) {" ^
"    $r += '--------------------------------' + $LF;" ^
"    $pay = if ($json.payment -eq 'cash') { 'ESPECES' } else { 'CARTE' };" ^
"    $r += $pay + $LF;" ^
"    if ($json.cashGiven) { $r += 'Recu     : ' + $json.cashGiven + $LF }" ^
"    if ($json.change -and [decimal]$json.change -gt 0) {" ^
"      $r += $GS + '!' + [char]17;" ^
"      $r += 'A RENDRE : ' + $json.change + $LF;" ^
"      $r += $GS + '!' + [char]0;" ^
"    }" ^
"  }" ^
"  $r += '================================' + $LF;" ^
"  if ($json.time) { $r += $json.time + $LF }" ^
"  $r += $LF;" ^
"  $r += $ESC + 'a' + [char]1;" ^
"  $r += '*** Merci ***' + $LF;" ^
"  $r += $LF + $LF + $LF + $LF;" ^
"  $r += $GS + 'V' + [char]66 + [char]0;" ^
"  return $r;" ^
"}" ^
"while ($listener.IsListening) {" ^
"  try {" ^
"    $context = $listener.GetContext();" ^
"    $request = $context.Request;" ^
"    $response = $context.Response;" ^
"    $response.Headers.Add('Access-Control-Allow-Origin', '*');" ^
"    $response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');" ^
"    $response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type');" ^
"    $path = $request.Url.AbsolutePath;" ^
"    $method = $request.HttpMethod;" ^
"    Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $method + ' ' + $path) -ForegroundColor Gray;" ^
"    if ($method -eq 'OPTIONS') {" ^
"      $response.StatusCode = 200;" ^
"      $response.Close();" ^
"      continue;" ^
"    }" ^
"    if ($path -eq '/ping') {" ^
"      $body = '{\"ok\":true,\"printer\":\"' + $printerIP + ':' + $printerPort + '\"}';" ^
"      $buf = [System.Text.Encoding]::UTF8.GetBytes($body);" ^
"      $response.ContentType = 'application/json';" ^
"      $response.ContentLength64 = $buf.Length;" ^
"      $response.OutputStream.Write($buf, 0, $buf.Length);" ^
"      $response.Close();" ^
"      Write-Host '  -> Ping OK' -ForegroundColor Cyan;" ^
"      continue;" ^
"    }" ^
"    if ($path -eq '/test') {" ^
"      $LF = [char]10; $ESC = [char]27; $GS = [char]29;" ^
"      $testTicket = $ESC + '@' + $ESC + 'a' + [char]1 + $GS + '!' + [char]17 + 'MA+' + $LF + $GS + '!' + [char]0 + 'TEST IMPRESSION' + $LF + '================================' + $LF + 'OK ! La passerelle fonctionne.' + $LF + $LF + (Get-Date -Format 'dd/MM/yyyy HH:mm:ss') + $LF + $LF + $LF + $LF + $GS + 'V' + [char]66 + [char]0;" ^
"      $ok = Send-ToPrinter $testTicket;" ^
"      $body = if ($ok) { '{\"ok\":true}' } else { '{\"ok\":false,\"error\":\"printer_unreachable\"}' };" ^
"      $buf = [System.Text.Encoding]::UTF8.GetBytes($body);" ^
"      $response.ContentType = 'application/json';" ^
"      $response.StatusCode = if ($ok) { 200 } else { 502 };" ^
"      $response.ContentLength64 = $buf.Length;" ^
"      $response.OutputStream.Write($buf, 0, $buf.Length);" ^
"      $response.Close();" ^
"      if ($ok) { Write-Host '  -> Test imprime !' -ForegroundColor Green } else { Write-Host '  -> Imprimante injoignable' -ForegroundColor Red };" ^
"      continue;" ^
"    }" ^
"    if ($path -eq '/print' -and $method -eq 'POST') {" ^
"      $reader = New-Object System.IO.StreamReader($request.InputStream);" ^
"      $bodyText = $reader.ReadToEnd();" ^
"      $reader.Close();" ^
"      try {" ^
"        $json = $bodyText | ConvertFrom-Json;" ^
"      } catch {" ^
"        $response.StatusCode = 400;" ^
"        $buf = [System.Text.Encoding]::UTF8.GetBytes('{\"error\":\"bad_json\"}');" ^
"        $response.OutputStream.Write($buf, 0, $buf.Length);" ^
"        $response.Close();" ^
"        Write-Host '  -> JSON invalide' -ForegroundColor Red;" ^
"        continue;" ^
"      }" ^
"      $ticket = Build-Receipt $json;" ^
"      $ok = Send-ToPrinter $ticket;" ^
"      $body = if ($ok) { '{\"ok\":true}' } else { '{\"ok\":false,\"error\":\"printer_unreachable\"}' };" ^
"      $buf = [System.Text.Encoding]::UTF8.GetBytes($body);" ^
"      $response.ContentType = 'application/json';" ^
"      $response.StatusCode = if ($ok) { 200 } else { 502 };" ^
"      $response.ContentLength64 = $buf.Length;" ^
"      $response.OutputStream.Write($buf, 0, $buf.Length);" ^
"      $response.Close();" ^
"      if ($ok) {" ^
"        $bip = if ($json.bipper) { '#' + $json.bipper } else { '' };" ^
"        Write-Host ('  -> Imprime ! ' + $bip + ' (' + $json.items.Count + ' articles)') -ForegroundColor Green;" ^
"      } else {" ^
"        Write-Host '  -> ECHEC : imprimante injoignable' -ForegroundColor Red;" ^
"      }" ^
"      continue;" ^
"    }" ^
"    $response.StatusCode = 404;" ^
"    $response.Close();" ^
"  } catch {" ^
"    Write-Host ('[ERREUR] ' + $_.Exception.Message) -ForegroundColor Red;" ^
"  }" ^
"}"

pause
