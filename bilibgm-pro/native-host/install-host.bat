@echo off
echo ==========================================
echo   BiliBGM Pro - Native Host Installer
echo ==========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

:: Get script directory
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: Install dependencies
echo [1/4] Installing dependencies...
cd /d "%SCRIPT_DIR%"
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

:: Build
echo [2/4] Building...
call npx tsc
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

:: Get Chrome extension ID
echo.
echo Please enter your Chrome Extension ID.
echo You can find it in chrome://extensions/ after loading the extension.
echo (Example: abcdefghijklmnopqrstuvwxyz123456)
echo.
set /p EXT_ID="Extension ID: "

if "%EXT_ID%"=="" (
    echo [ERROR] Extension ID cannot be empty.
    pause
    exit /b 1
)

:: Create run script
echo [3/4] Creating run script...
set "RUN_SCRIPT=%SCRIPT_DIR%\run-host.bat"
(
echo @echo off
echo cd /d "%SCRIPT_DIR%"
echo node dist\index.js
) > "%RUN_SCRIPT%"

:: Update manifest
set "MANIFEST_FILE=%SCRIPT_DIR%\com.bilibgm.pro.json"
set "MANIFEST_TEMP=%SCRIPT_DIR%\com.bilibgm.pro.json.tmp"

powershell -Command "$json = Get-Content '%MANIFEST_FILE%' -Raw | ConvertFrom-Json; $json.path = '%RUN_SCRIPT:\=\\%'; $json.allowed_origins = @('chrome-extension://%EXT_ID%/'); $json | ConvertTo-Json -Depth 5" > "%MANIFEST_TEMP%"
move /y "%MANIFEST_TEMP%" "%MANIFEST_FILE%" >nul

:: Register in Windows Registry
echo [4/4] Registering Native Messaging Host...
set "REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.bilibgm.pro"
reg add "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f >nul

echo.
echo ==========================================
echo   Installation Complete!
echo ==========================================
echo.
echo Native Host Path: %RUN_SCRIPT%
echo Manifest: %MANIFEST_FILE%
echo Extension ID: %EXT_ID%
echo.
echo Please restart Chrome for changes to take effect.
echo.
pause
