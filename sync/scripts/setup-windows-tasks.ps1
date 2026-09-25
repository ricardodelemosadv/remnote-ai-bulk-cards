# setup-windows-tasks.ps1
# Configura todas as tarefas automáticas na máquina RICARDO MPSP
# Executa como Administrador

param(
    [string]$VaultPath      = "C:\OBSIDIAN",
    [string]$OnedriveFolder = "$env:USERPROFILE\OneDrive\JurisMPSP",
    [string]$ScriptsDir     = "C:\sync-mpsp",
    [string]$PythonExe      = "python"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Setup automação MPSP — RICARDO MPSP ===" -ForegroundColor Cyan

# ── 1. Criar diretório de trabalho ──────────────────────────────────────────
if (-not (Test-Path $ScriptsDir)) {
    New-Item -ItemType Directory -Path $ScriptsDir | Out-Null
    Write-Host "Criado: $ScriptsDir" -ForegroundColor Green
}

# Copiar scripts Python para o diretório de trabalho
$repoScripts = @(
    "import-legal-delta.py",
    "generate-checkpoint.py"
)
foreach ($script in $repoScripts) {
    $src = Join-Path $PSScriptRoot $script
    $dst = Join-Path $ScriptsDir $script
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "Copiado: $script → $ScriptsDir" -ForegroundColor Gray
    } else {
        Write-Host "AVISO: $src não encontrado. Coloque os scripts Python em $ScriptsDir manualmente." -ForegroundColor Yellow
    }
}

# ── 2. Script wrapper para import diário ────────────────────────────────────
$dailyImportScript = @"
@echo off
setlocal

set SCRIPTS_DIR=$ScriptsDir
set VAULT=$VaultPath
set ONEDRIVE=$OnedriveFolder
set LOG=%SCRIPTS_DIR%\import.log

echo [%date% %time%] Iniciando import OneDrive → Obsidian >> "%LOG%"

REM Gerar checkpoint do dia
set TODAY=%date:~6,4%%date:~3,2%%date:~0,2%
set CHECKPOINT=%SCRIPTS_DIR%\CHECKPOINT-LEGAL-DELTA-%TODAY%.json

$PythonExe "%SCRIPTS_DIR%\generate-checkpoint.py" --onedrive "%ONEDRIVE%" --output "%CHECKPOINT%" --since %date:~6,4%-%date:~3,2%-%date:~0,2% >> "%LOG%" 2>&1

if not exist "%CHECKPOINT%" (
    echo [%date% %time%] Nenhum checkpoint gerado - sem arquivos novos >> "%LOG%"
    exit /b 0
)

REM Importar no vault
$PythonExe "%SCRIPTS_DIR%\import-legal-delta.py" "%CHECKPOINT%" --vault "%VAULT%" --folder 01-Entrada --interval 10 >> "%LOG%" 2>&1

echo [%date% %time%] Import concluido >> "%LOG%"
"@
$dailyImportPath = "$ScriptsDir\daily-import.bat"
$dailyImportScript | Set-Content -Path $dailyImportPath -Encoding ASCII
Write-Host "Script diário: $dailyImportPath" -ForegroundColor Green

# ── 3. Script wrapper para ngrok ────────────────────────────────────────────
$ngrokScript = @"
@echo off
REM Inicia o túnel ngrok para Obsidian REST API
REM Roda em background ao login
set LOG=C:\ngrok\ngrok.log
if exist "C:\ngrok\ngrok.exe" (
    start /B C:\ngrok\ngrok.exe start obsidian --config "%USERPROFILE%\.ngrok2\ngrok.yml" > "%LOG%" 2>&1
) else (
    echo ngrok nao encontrado em C:\ngrok\ >> "%LOG%"
)
"@
$ngrokScriptPath = "$ScriptsDir\start-ngrok.bat"
$ngrokScript | Set-Content -Path $ngrokScriptPath -Encoding ASCII

# ── 4. Registrar tarefas no Task Scheduler ──────────────────────────────────

function Register-Task {
    param($Name, $Execute, $Argument, $TriggerDesc, $Trigger)
    try {
        Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
        $action   = New-ScheduledTaskAction -Execute $Execute -Argument $Argument
        $settings = New-ScheduledTaskSettingsSet `
            -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
            -RestartCount 2 `
            -RestartInterval (New-TimeSpan -Minutes 5) `
            -StartWhenAvailable $true
        Register-ScheduledTask -TaskName $Name -Action $action -Trigger $Trigger -Settings $settings -RunLevel Highest -Force | Out-Null
        Write-Host "Tarefa registrada: $Name ($TriggerDesc)" -ForegroundColor Green
    } catch {
        Write-Host "ERRO ao registrar $Name`: $_" -ForegroundColor Red
    }
}

# 4a. ngrok — ao fazer login
Register-Task `
    -Name "MPSP-ngrok-Obsidian" `
    -Execute "cmd.exe" `
    -Argument "/c `"$ngrokScriptPath`"" `
    -TriggerDesc "ao login" `
    -Trigger (New-ScheduledTaskTrigger -AtLogon)

# 4b. Import OneDrive → Obsidian — todo dia às 06:30
Register-Task `
    -Name "MPSP-Import-OneDrive-Obsidian" `
    -Execute "cmd.exe" `
    -Argument "/c `"$dailyImportPath`"" `
    -TriggerDesc "diário 06:30" `
    -Trigger (New-ScheduledTaskTrigger -Daily -At "06:30")

# 4c. Import OneDrive → Obsidian — ao fazer login (garante que dias perdidos recuperam)
Register-Task `
    -Name "MPSP-Import-OneDrive-Obsidian-Login" `
    -Execute "cmd.exe" `
    -Argument "/c `"$dailyImportPath`"" `
    -TriggerDesc "ao login (recuperação)" `
    -Trigger (New-ScheduledTaskTrigger -AtLogon)

# ── 5. Verificar Python ──────────────────────────────────────────────────────
Write-Host "`nVerificando Python..." -ForegroundColor Yellow
try {
    $ver = & $PythonExe --version 2>&1
    Write-Host "Python: $ver" -ForegroundColor Green
} catch {
    Write-Host "AVISO: Python não encontrado. Instale em https://python.org" -ForegroundColor Red
}

# ── 6. Resumo ────────────────────────────────────────────────────────────────
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host " Tarefas configuradas:" -ForegroundColor Cyan
Write-Host "   MPSP-ngrok-Obsidian              → ao login" -ForegroundColor White
Write-Host "   MPSP-Import-OneDrive-Obsidian    → diário 06:30" -ForegroundColor White
Write-Host "   MPSP-Import-OneDrive-Obsidian-Login → ao login" -ForegroundColor White
Write-Host ""
Write-Host " Vault destino: $VaultPath\01-Entrada\" -ForegroundColor White
Write-Host " OneDrive fonte: $OnedriveFolder" -ForegroundColor White
Write-Host " Logs: $ScriptsDir\import.log" -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para executar imediatamente:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName 'MPSP-Import-OneDrive-Obsidian'" -ForegroundColor Gray
Write-Host ""
Write-Host "Para ver logs:" -ForegroundColor Yellow
Write-Host "  Get-Content $ScriptsDir\import.log -Tail 50" -ForegroundColor Gray
