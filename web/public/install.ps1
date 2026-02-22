# MCLC Installer Script for Windows
# Run with: iwr https://mclc.pluginhub.de/install.ps1 | iex

$repo = "MCLC-Client/MCLC-Client"
$baseUrl = "https://github.com/$repo/releases/latest/download"
$filename = "MCLC-setup.exe"
$url = "$baseUrl/$filename"
$tempPath = [System.IO.Path]::GetTempFileName() + ".exe"

Write-Host "--- MCLC Installer ---" -ForegroundColor Cyan
Write-Host "Downloading MCLC from $url..."

try {
    Invoke-WebRequest -Uri $url -OutFile $tempPath -ErrorAction Stop
    Write-Host "Download successful." -ForegroundColor Green
    
    Write-Host "Starting installer..." -ForegroundColor Yellow
    Start-Process -FilePath $tempPath -Wait
    
    Write-Host "Installation completed or installer closed." -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if (Test-Path $tempPath) {
        Remove-Item $tempPath -Force
    }
}

Write-Host "----------------------"
