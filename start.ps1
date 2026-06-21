Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  滑板公园预约系统 - Docker 一键启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] 停止并清理旧容器..." -ForegroundColor Yellow
docker-compose down
Write-Host ""

Write-Host "[2/3] 构建并启动服务..." -ForegroundColor Yellow
docker-compose up -d --build
Write-Host ""

Write-Host "[3/3] 等待服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  服务启动完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  前端地址: http://localhost:2071" -ForegroundColor White
Write-Host "  后端地址: http://localhost:6071" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "查看日志: docker-compose logs -f" -ForegroundColor Gray
Write-Host "停止服务: docker-compose down" -ForegroundColor Gray
Write-Host ""

Read-Host "按回车键退出"
