@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

REM ===== 一鍵（重新）啟動：遊戲伺服器 + Cloudflare 外網通道 =====
REM 遊戲：npm run dev（vite，固定 5175，/comfy 代理只有 dev / preview 才有）
REM 外網：cloudflared 快速通道（trycloudflare.com，免登入、HTTPS，網址每次重啟都會變）

set PORT=5175
set LOG=%TEMP%\chibi-tunnel.log

echo [1/4] 停止舊的伺服器與通道...
REM 只停佔用 %PORT% 的程式，以及轉發到 %PORT% 的 cloudflared；其他通道（例如指向 5000 的）不動
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cloudflared.exe'\" | Where-Object { $_.CommandLine -like '*:%PORT%*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
if exist "%LOG%" del "%LOG%"

echo [2/4] 啟動遊戲伺服器（另開視窗，關掉該視窗即停止）...
start "Game Server - vite :%PORT%" cmd /k npm run dev

echo [3/4] 等待伺服器就緒...
powershell -NoProfile -Command "foreach ($i in 1..30) { try { Invoke-WebRequest http://127.0.0.1:%PORT% -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { Start-Sleep 1 } }; exit 1"
if errorlevel 1 (
  echo 伺服器 30 秒內沒有起來，請看 "Game Server" 視窗的錯誤訊息。
  pause
  exit /b 1
)

echo [4/4] 啟動 Cloudflare 通道（最小化視窗，關掉即斷線）...
REM --http-host-header：把 Host 改成 127.0.0.1，避開 vite 的 allowedHosts 擋外部網域
start "Cloudflare Tunnel" /min cloudflared tunnel --no-autoupdate --http-host-header 127.0.0.1:%PORT% --url http://127.0.0.1:%PORT% --logfile "%LOG%"

set URL=
for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "foreach ($i in 1..30) { $m = Select-String -Path '%LOG%' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue; if ($m) { $m[0].Matches[0].Value; break }; Start-Sleep 1 }"`) do set URL=%%u

echo.
if defined URL (
  echo 本機： http://127.0.0.1:%PORT%
  echo 外網： %URL%
  echo %URL%| clip
  echo （外網網址已複製到剪貼簿）
) else (
  echo 30 秒內沒取得外網網址，請看 "Cloudflare Tunnel" 視窗，或開啟記錄檔：%LOG%
)
echo.
pause
