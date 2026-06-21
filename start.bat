@echo off
echo ========================================
echo   滑板公园预约系统 - Docker 一键启动
echo ========================================
echo.
echo [1/3] 停止并清理旧容器...
docker-compose down
echo.
echo [2/3] 构建并启动服务...
docker-compose up -d --build
echo.
echo [3/3] 等待服务启动...
timeout /t 5 /nobreak >nul
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
