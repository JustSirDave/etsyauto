@echo off
REM Clear all user login data from database

echo.
echo ========================================
echo   WARNING: DELETE ALL USER DATA
echo ========================================
echo This will permanently delete:
echo - All user accounts
echo - All organizations/tenants
echo - All shops, products, listings
echo - All orders and schedules
echo ========================================
echo.

set /p confirm="Are you sure? Type YES to continue: "

if /i not "%confirm%"=="YES" (
    echo.
    echo Cancelled.
    exit /b 1
)

echo.
echo Clearing database...
echo.

docker-compose exec -T db psql -U postgres -d etsy_platform -c "TRUNCATE TABLE users CASCADE;"

echo.
echo ========================================
echo   DATABASE CLEARED SUCCESSFULLY
echo ========================================
echo.

docker-compose exec -T db psql -U postgres -d etsy_platform -c "SELECT COUNT(*) as remaining_users FROM users;"

echo.
pause
