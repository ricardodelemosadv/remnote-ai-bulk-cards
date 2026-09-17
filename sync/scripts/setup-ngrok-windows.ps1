# setup-ngrok-windows.ps1
# Executa na máquina RICARDO MPSP (Windows)
# Expõe o Obsidian Local REST API (porta 27123) para o n8n cloud via ngrok

param(
    [Parameter(Mandatory=$true)]
    [string]$NgrokAuthToken,

    [Parameter(Mandatory=$false)]
    [string]$N8nCloudUrl = "https://ric88k.app.n8n.cloud"
)

$ErrorActionPreference = "Stop"
$ObsidianPort = 27123

Write-Host "=== Setup ngrok para Obsidian REST API ===" -ForegroundColor Cyan

# 1. Verificar se ngrok já está instalado
$ngrokPath = (Get-Command ngrok -ErrorAction SilentlyContinue)?.Source
if (-not $ngrokPath) {
    Write-Host "Baixando ngrok..." -ForegroundColor Yellow
    $zipUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
    $zipPath = "$env:TEMP\ngrok.zip"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath "C:\ngrok" -Force
    $ngrokPath = "C:\ngrok\ngrok.exe"
    # Adicionar ao PATH do usuário
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*C:\ngrok*") {
        [Environment]::SetEnvironmentVariable("PATH", "$userPath;C:\ngrok", "User")
    }
    Write-Host "ngrok instalado em C:\ngrok\" -ForegroundColor Green
}

# 2. Autenticar ngrok
Write-Host "Configurando token ngrok..." -ForegroundColor Yellow
& $ngrokPath config add-authtoken $NgrokAuthToken

# 3. Verificar se Obsidian Local REST API está rodando
Write-Host "Verificando Obsidian Local REST API na porta $ObsidianPort..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$ObsidianPort/" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "Obsidian REST API: OK" -ForegroundColor Green
} catch {
    Write-Host "AVISO: Obsidian REST API nao respondeu em localhost:$ObsidianPort" -ForegroundColor Red
    Write-Host "Certifique-se de que:" -ForegroundColor Yellow
    Write-Host "  1. Obsidian esta aberto" -ForegroundColor Yellow
    Write-Host "  2. Plugin 'Local REST API' esta ativado" -ForegroundColor Yellow
    Write-Host "  3. Plugin esta configurado na porta $ObsidianPort" -ForegroundColor Yellow
    $continue = Read-Host "Continuar mesmo assim? (s/N)"
    if ($continue -ne "s" -and $continue -ne "S") { exit 1 }
}

# 4. Criar arquivo de configuração ngrok
$ngrokConfig = @"
version: "2"
authtoken: $NgrokAuthToken
tunnels:
  obsidian:
    proto: http
    addr: $ObsidianPort
    inspect: false
"@
$configPath = "$env:USERPROFILE\.ngrok2\ngrok.yml"
New-Item -ItemType Directory -Force -Path (Split-Path $configPath) | Out-Null
$ngrokConfig | Set-Content -Path $configPath -Encoding UTF8
Write-Host "Configuracao ngrok salva em $configPath" -ForegroundColor Green

# 5. Criar script de startup para Windows (Task Scheduler)
$startupScript = @"
@echo off
cd /d C:\ngrok
start /B ngrok start obsidian --config "%USERPROFILE%\.ngrok2\ngrok.yml" > "%TEMP%\ngrok.log" 2>&1
timeout /t 5 /nobreak > nul
curl -s http://localhost:4040/api/tunnels
"@
$startupPath = "C:\ngrok\start-obsidian-tunnel.bat"
$startupScript | Set-Content -Path $startupPath -Encoding ASCII
Write-Host "Script de startup salvo em $startupPath" -ForegroundColor Green

# 6. Registrar no Task Scheduler para rodar no login
Write-Host "Registrando tarefa no Task Scheduler..." -ForegroundColor Yellow
$taskAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$startupPath`""
$taskTrigger = New-ScheduledTaskTrigger -AtLogon
$taskSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "Obsidian-ngrok-Tunnel" -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Force | Out-Null
Write-Host "Tarefa agendada: 'Obsidian-ngrok-Tunnel' rodara no login" -ForegroundColor Green

# 7. Iniciar o túnel agora
Write-Host "`nIniciando tunel ngrok..." -ForegroundColor Cyan
Start-Process -FilePath $ngrokPath -ArgumentList "start obsidian --config `"$configPath`"" -WindowStyle Hidden

Start-Sleep -Seconds 5

# 8. Obter a URL pública
Write-Host "Obtendo URL publica do tunel..." -ForegroundColor Yellow
try {
    $tunnelInfo = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 10
    $publicUrl = $tunnelInfo.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url

    if ($publicUrl) {
        Write-Host "`n======================================" -ForegroundColor Green
        Write-Host "TUNEL ATIVO!" -ForegroundColor Green
        Write-Host "URL publica: $publicUrl" -ForegroundColor Green
        Write-Host "======================================`n" -ForegroundColor Green

        Write-Host "PROXIMOS PASSOS:" -ForegroundColor Cyan
        Write-Host "1. Acesse: $N8nCloudUrl" -ForegroundColor White
        Write-Host "2. Settings > Variables" -ForegroundColor White
        Write-Host "3. Adicione/atualize: OBSIDIAN_BASE_URL = $publicUrl" -ForegroundColor White
        Write-Host "4. Adicione: OBSIDIAN_API_KEY = (sua chave do plugin Local REST API)" -ForegroundColor White
        Write-Host ""
        Write-Host "Para verificar o tunel: http://localhost:4040" -ForegroundColor Yellow

        # Salvar URL em arquivo para referência
        "OBSIDIAN_BASE_URL=$publicUrl" | Set-Content -Path "C:\ngrok\current-tunnel-url.txt" -Encoding UTF8
        Write-Host "URL salva em C:\ngrok\current-tunnel-url.txt" -ForegroundColor Gray
    } else {
        Write-Host "Nao foi possivel obter a URL. Verifique http://localhost:4040" -ForegroundColor Red
    }
} catch {
    Write-Host "Erro ao consultar ngrok API: $_" -ForegroundColor Red
    Write-Host "Verifique manualmente: http://localhost:4040/api/tunnels" -ForegroundColor Yellow
}
