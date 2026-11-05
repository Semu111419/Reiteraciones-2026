@echo off
title Reiteraciones - Obra Generativa para Violin y Electronica
echo =======================================================
echo   REITERACIONES - Violin y Electronica Generativa
echo   Iniciando servidor local con anti-cache en http://localhost:8000 ...
echo =======================================================
echo.
start "" "http://localhost:8000"
python server.py
pause
