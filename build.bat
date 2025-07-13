@echo off
REM Build script for expense-tracker Docker image (Windows)
REM Usage: build.bat [tag]

setlocal enabledelayedexpansion

REM Default tag
if "%1"=="" (
    set TAG=latest
) else (
    set TAG=%1
)

set IMAGE_NAME=tylerrichey/expense-tracker
set FULL_TAG=%IMAGE_NAME%:%TAG%

echo Building Docker image: %FULL_TAG%

REM Build the Docker image
docker build -t "%FULL_TAG%" .

if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

echo Successfully built %FULL_TAG%

REM Also tag as latest if a specific tag was provided
if not "%TAG%"=="latest" (
    docker tag "%FULL_TAG%" "%IMAGE_NAME%:latest"
    echo Also tagged as %IMAGE_NAME%:latest
)

echo Build complete!
echo.
echo To run the container:
echo   docker run -p 3000:3000 %FULL_TAG%
echo   # Or with custom port:
echo   docker run -p 8080:8080 -e PORT=8080 %FULL_TAG%
echo.
echo To push to Docker Hub:
echo   docker push %FULL_TAG%
if not "%TAG%"=="latest" (
    echo   docker push %IMAGE_NAME%:latest
)

endlocal