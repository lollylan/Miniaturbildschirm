@echo off
rem Oeffnet die Anzeige als normales 800x480-Fenster auf dem Hauptbildschirm (Esc beendet).
cd /d "%~dp0"
start "" "%~dp0node_modules\.bin\electron.cmd" . --preview
