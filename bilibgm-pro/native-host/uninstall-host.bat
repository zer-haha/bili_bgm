@echo off
echo ==========================================
echo   BiliBGM Pro - Uninstall Native Host
echo ==========================================
echo.

set "REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.bilibgm.pro"

echo Removing registry entry...
reg delete "%REG_KEY%" /f >nul 2>nul

echo.
echo Native Host has been unregistered.
echo You can safely delete the native-host folder.
echo.
echo Please restart Chrome for changes to take effect.
echo.
pause
