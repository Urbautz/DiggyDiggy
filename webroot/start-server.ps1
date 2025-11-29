# Simple HTTP server for local development
# This allows Web Workers to function properly

Write-Host "Starting local web server..." -ForegroundColor Green
Write-Host "The game will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Check if Python is available
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}

if ($pythonCmd) {
    Write-Host "Using Python HTTP server..." -ForegroundColor Green
    & $pythonCmd -m http.server 8000
} else {
    # Fallback to PowerShell's built-in web server (Windows 10+)
    Write-Host "Using PowerShell HTTP server..." -ForegroundColor Green
    
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:8000/")
    $listener.Start()
    
    Write-Host "Server started at http://localhost:8000" -ForegroundColor Green
    Write-Host "Opening browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:8000"
    
    try {
        while ($listener.IsListening) {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response
            
            $path = $request.Url.LocalPath
            if ($path -eq "/") { $path = "/index.html" }
            
            $filePath = Join-Path $PSScriptRoot $path.TrimStart('/')
            
            if (Test-Path $filePath) {
                $content = [System.IO.File]::ReadAllBytes($filePath)
                
                # Set content type
                $ext = [System.IO.Path]::GetExtension($filePath)
                $contentType = switch ($ext) {
                    ".html" { "text/html" }
                    ".css"  { "text/css" }
                    ".js"   { "application/javascript" }
                    ".json" { "application/json" }
                    ".png"  { "image/png" }
                    ".jpg"  { "image/jpeg" }
                    ".gif"  { "image/gif" }
                    default { "application/octet-stream" }
                }
                
                $response.ContentType = $contentType
                $response.ContentLength64 = $content.Length
                $response.OutputStream.Write($content, 0, $content.Length)
            } else {
                $response.StatusCode = 404
                $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 - File not found")
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            
            $response.Close()
        }
    }
    finally {
        $listener.Stop()
    }
}
