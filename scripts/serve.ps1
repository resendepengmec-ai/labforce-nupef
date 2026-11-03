param(
  [string]$Root = (Get-Location).Path,
  [int]$Port = 4173
)

# Servidor local de desenvolvimento (so 127.0.0.1). Um pedido por vez; cada conexao tem
# tempo limite e erro proprio, para uma aba fechada no meio de um arquivo grande (ex.: o
# video) nao derrubar o servidor nem uma conexao ociosa travar as outras.
$rootPath = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\') + '\'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
$listener.Start()

Write-Host "LabForce NUPEF em http://127.0.0.1:$Port/"

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".mjs" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".txt" = "text/plain; charset=utf-8"
  ".tsv" = "text/tab-separated-values; charset=utf-8"
  ".vtt" = "text/vtt; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".svg" = "image/svg+xml"
  ".mp4" = "video/mp4"
}
# Host aceito: protege contra DNS rebinding (um site externo lendo os ensaios desta pasta)
$hostsOk = @("127.0.0.1:$Port", "localhost:$Port")

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

function Send-Text([System.Net.Sockets.NetworkStream]$Stream, [int]$Code, [string]$Status, [string]$Text) {
  Send-Response -Stream $Stream -StatusCode $Code -StatusText $Status -ContentType "text/plain; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($Text))
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $client.SendTimeout = 30000
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      $hostHeader = ""
      while ($true) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) { break }
        if ($line -match "^Host:\s*(.+)$") { $hostHeader = $Matches[1].Trim() }
      }

      if ($hostsOk -notcontains $hostHeader) {
        Send-Text $stream 403 "Forbidden" "Host nao permitido"
      }
      elseif ($requestLine -match "^GET\s+([^\s]+)\s+HTTP/") {
        $requestPath = [System.Uri]::UnescapeDataString($Matches[1].Split("?")[0].TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = "index.html" }

        $target = Join-Path $rootPath $requestPath
        if (Test-Path -LiteralPath $target -PathType Container) { $target = Join-Path $target "index.html" }

        $resolvedTarget = $null
        if (Test-Path -LiteralPath $target -PathType Leaf) { $resolvedTarget = (Resolve-Path -LiteralPath $target).Path }

        # com a barra final: "labforce-nupef-antigo\" nao passa por "labforce-nupef\"
        if ($resolvedTarget -and $resolvedTarget.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
          $bytes = [System.IO.File]::ReadAllBytes($resolvedTarget)
          $contentType = $mimeTypes[[System.IO.Path]::GetExtension($resolvedTarget).ToLowerInvariant()]
          if (-not $contentType) { $contentType = "application/octet-stream" }
          Send-Response -Stream $stream -StatusCode 200 -StatusText "OK" -ContentType $contentType -Body $bytes
        }
        else {
          Send-Text $stream 404 "Not Found" "Not found"
        }
      }
      else {
        Send-Text $stream 400 "Bad Request" "Bad request"
      }
    }
    catch {
      # cliente fechou a conexao ou ficou ocioso: segue para o proximo
    }
    finally {
      if ($reader) { $reader.Dispose(); $reader = $null }
      if ($stream) { $stream.Dispose(); $stream = $null }
      $client.Dispose()
    }
  }
}
finally {
  $listener.Stop()
}
