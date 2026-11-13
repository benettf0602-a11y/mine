@echo off
REM MinePixel telepito epitese: Node.js es Inno Setup 6 kell hozza.
cd /d "%~dp0.."
call npm install || goto :err
call npm run pack || goto :err
set ISCC=
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe
if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set ISCC=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe
if "%ISCC%"=="" (echo Nem talalom az Inno Setup 6-ot. Telepitsd: https://jrsoftware.org/isdl.php & goto :err)
"%ISCC%" installer\MinePixel.iss || goto :err
echo.
echo KESZ: installer\Output\MinePixel_Setup_1.1.0.exe
pause
exit /b 0
:err
echo HIBA tortent.
pause
exit /b 1
