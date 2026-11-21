@echo off
chcp 65001 >nul
title 更新网站（网站改版2）
cd /d "%~dp0"

echo ============================================
echo   更新网站 —— 工学部研究生事务服务中心
echo ============================================
echo.

REM ---- 找 python ----
set PY=
where python >nul 2>nul && set PY=python
if not defined PY (
    where py >nul 2>nul && set PY=py -3
)
if not defined PY (
    echo [错误] 没有找到 Python。
    echo.
    echo 请先安装 Python 3.8 或更新版本，安装时勾选
    echo "Add Python to PATH"，然后重新运行本文件。
    echo.
    pause
    exit /b 1
)

echo 使用：%PY%
echo.

REM ---- 构建 ----
%PY% "网站改版2\tools\make.py"
if errorlevel 1 (
    echo.
    echo ============================================
    echo   构建失败，请看上面的报错信息
    echo ============================================
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   构建成功
echo ============================================
echo.
echo 预览地址：网站改版2\_preview\index.html
echo.

REM ---- 打开预览（带版本号，绕开浏览器缓存） ----
for /f %%i in ('powershell -NoProfile -Command "[DateTimeOffset]::Now.ToUnixTimeSeconds()"') do set VER=%%i
start "" "%~dp0网站改版2\_preview\index.html?v=%VER%"

echo 已打开预览页面。
echo.
echo 上线步骤：git add -A  然后  git commit -m "更新网站内容"  然后  git push
echo （push 后 GitHub Actions 会自动重新构建并部署）
echo.
pause
