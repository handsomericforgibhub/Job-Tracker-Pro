@echo off
echo Starting JobTracker Pro Development Server...
echo.
echo Opening browser to http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"
start "" "http://localhost:3000"
npm run dev

pause