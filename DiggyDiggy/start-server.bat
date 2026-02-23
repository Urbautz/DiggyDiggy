@echo off
echo Starting Diggy Diggy Server...
echo.
echo Checking for Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js found!
echo Starting server on http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
node server.js
pause
