@echo off
rem Startet den Praxisbildschirm aus dem Quellcode (Entwicklung). Fuer den Praxisbetrieb die EXE aus dem Ordner "dist" verwenden.
cd /d "%~dp0"
start "" "%~dp0node_modules\.bin\electron.cmd" .
