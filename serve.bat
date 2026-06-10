@echo off
echo.
echo  Camino al Si - Servidor Local
echo  ==============================
echo  Abre en tu navegador:  http://localhost:8000/game.html
echo.
start http://localhost:8000/game.html
python -m http.server 8000
