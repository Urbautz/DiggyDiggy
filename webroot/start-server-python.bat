@echo off
echo Starting Diggy Diggy Server (Python)...
echo.
echo Checking for Python...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python is not installed!
    echo Please install Python from https://www.python.org/
    echo.
    pause
    exit /b 1
)

echo Python found!
echo Starting server on http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
python server.py
pause
