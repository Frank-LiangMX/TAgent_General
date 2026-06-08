# dev-kill-all.ps1
# 清理 TAgent dev 残留进程（electron / electronmon / vite / esbuild / bun + 5173 端口）
# dev-stop.bat 调用此脚本，避开 cmd 的二次 PowerShell 变量转义

$processes = @('electron', 'electronmon', 'vite', 'esbuild', 'bun')
foreach ($name in $processes) {
  Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
      Write-Output ("  killed {0} PID={1}" -f $_.ProcessName, $_.Id)
    } catch {}
  }
}

$conn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Write-Output ("  killed leftover vite PID={0}" -f $conn.OwningProcess)
}

# 验证
$conn2 = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conn2) {
  Write-Output "  [!!] 5173 still held by PID=$($conn2.OwningProcess)"
} else {
  Write-Output "  [OK] 5173 free"
}
