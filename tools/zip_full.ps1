Add-Type -Assembly 'System.IO.Compression.FileSystem'

$distPath = Join-Path $PSScriptRoot '..\dist'
$zipPath = Join-Path $PSScriptRoot '..\DYE_MASTER_v3.0.0_FULL_20260522.zip'

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $distPath,
    $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "ZIP created: $zipPath ($size MB)"
