param(
  [string]$Root = (Get-Location).Path,
  [int]$Port = 4173
)

$rootPath = (Resolve-Path -LiteralPath $Root).Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
$listener.Start()

Write-Host "ForceLab running at http://127.0.0.1:$Port/"

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body
  )

  $header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()

    if ($requestLine -match "^GET\s+([^\s]+)\s+HTTP/") {
      $requestPath = [System.Uri]::UnescapeDataString($Matches[1].Split("?")[0].TrimStart("/"))

      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
      }

      $target = Join-Path $rootPath $requestPath

      if (Test-Path -LiteralPath $target -PathType Container) {
        $target = Join-Path $target "index.html"
      }

      $exists = Test-Path -LiteralPath $target -PathType Leaf
      $resolvedTarget = $null

      if ($exists) {
        $resolvedTarget = (Resolve-Path -LiteralPath $target).Path
      }

      if ($exists -and $resolvedTarget.StartsWith($rootPath)) {
        $bytes = [System.IO.File]::ReadAllBytes($resolvedTarget)
        $extension = [System.IO.Path]::GetExtension($resolvedTarget).ToLowerInvariant()
        $contentType = $mimeTypes[$extension]

        if (-not $contentType) {
          $contentType = "application/octet-stream"
        }

        Send-Response -Stream $stream -StatusCode 200 -StatusText "OK" -ContentType $contentType -Body $bytes
      }
      else {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Send-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -ContentType "text/plain; charset=utf-8" -Body $bytes
      }
    }
    else {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Bad request")
      Send-Response -Stream $stream -StatusCode 400 -StatusText "Bad Request" -ContentType "text/plain; charset=utf-8" -Body $bytes
    }

    $reader.Dispose()
    $stream.Dispose()
    $client.Dispose()
  }
}
finally {
  $listener.Stop()
}
