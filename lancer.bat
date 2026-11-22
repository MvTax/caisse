@echo off
rem Lance le testeur d'impression (Windows). Necessite Python 3 : https://www.python.org
cd /d "%~dp0"
where py >nul 2>nul && (py -3 serveur.py & goto :fin)
where python >nul 2>nul && (python serveur.py & goto :fin)
echo Python 3 n'est pas installe. Telechargez-le sur https://www.python.org
echo (cochez "Add python.exe to PATH" pendant l'installation), puis relancez ce fichier.
:fin
pause
