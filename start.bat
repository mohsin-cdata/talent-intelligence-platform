@echo off
echo Talent Intelligence Platform - Setup and Launch
echo ================================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Download it from https://nodejs.org and re-run this script.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo Node.js %NODE_VER% found.

:: Install dependencies if needed
if not exist "node_modules\" (
    echo.
    echo Installing dependencies ^(first run only^)...
    npm install
    if errorlevel 1 (
        echo ERROR: npm install failed. Check the output above.
        pause
        exit /b 1
    )
)

:: Copy .env.local silently if missing
if not exist ".env.local" (
    if exist ".env.local.example" (
        copy ".env.local.example" ".env.local" >nul
    )
)

:: Open browser after short delay
echo.
echo Starting server at http://localhost:3000
echo You can enter your API keys and configure your data source in the app.
echo Press Ctrl+C to stop.
echo.
start "" /B cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Start server
npm run dev
