@echo off
echo ========================================
echo   滑板公园预约系统 - Docker 一键启动
echo ========================================
echo.

echo [1/5] 停止并清理旧容器...
docker-compose down >nul 2>nul
echo.

echo [2/5] 清理端口占用进程 (2071, 6071)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :2071 ^| findstr LISTENING') do (
    echo   终止占用端口 2071 的进程 PID: %%a
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :6071 ^| findstr LISTENING') do (
    echo   终止占用端口 6071 的进程 PID: %%a
    taskkill /F /PID %%a >nul 2>nul
)
timeout /t 2 /nobreak >nul
echo.

echo [3/5] 构建并启动服务...
docker-compose up -d --build
echo.

echo [4/5] 等待服务启动...
timeout /t 5 /nobreak >nul
echo.

echo [5/5] 验证服务状态...
docker-compose ps
echo.

echo ========================================
echo   服务启动完成！
echo ========================================
echo   前端地址: http://localhost:2071
echo   后端地址: http://localhost:6071
echo ========================================
echo.
echo 查看日志: docker-compose logs -f
echo 停止服务: docker-compose down
echo.
pause
