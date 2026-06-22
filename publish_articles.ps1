$ErrorActionPreference = "Stop"
$base = "https://tax-clearance.onrender.com"
$imgDir = ".\images"
$jsonFile = ".\articles_data.json"

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-WebRequest -Uri "$base/admin/login" -Method POST -Body @{username="admin";password="TaxClearance2024!"} -WebSession $session -MaximumRedirection 5 -UseBasicParsing | Out-Null
Write-Host "✅ Logged in"

$jsonText = [System.IO.File]::ReadAllText((Resolve-Path $jsonFile).Path, [System.Text.Encoding]::UTF8)
$articles = $jsonText | ConvertFrom-Json

$ok = 0
foreach ($art in $articles) {
  Write-Host "Publishing: $($art.title.Substring(0,[Math]::Min(60,$art.title.Length)))..."
  $boundary = [System.Guid]::NewGuid().ToString()
  $LF = "`r`n"
  $ms = New-Object System.IO.MemoryStream
  $enc = [System.Text.Encoding]::UTF8

  $fields = @{
    title=$art.title; slug=$art.slug; excerpt=$art.excerpt; content=$art.content
    category_id=$art.cat; status="published"; reading_time=$art.read
    seo_title=$art.seo_t; seo_description=$art.seo_d; seo_keywords=$art.seo_k
    is_featured=$art.featured; is_trending=$art.trending
  }
  
  foreach ($k in $fields.Keys) {
    $p = "--$boundary$LF" + "Content-Disposition: form-data; name=`"$k`"$LF$LF" + "$($fields[$k])$LF"
    $b = $enc.GetBytes($p); $ms.Write($b,0,$b.Length)
  }
  
  # Image
  if ($art.img -ne "" -and (Test-Path "$imgDir\$($art.img)")) {
    $imgAbsPath = (Resolve-Path "$imgDir\$($art.img)").Path
    $ib = [System.IO.File]::ReadAllBytes($imgAbsPath)
    $fp = "--$boundary$LF" + "Content-Disposition: form-data; name=`"featured_image`"; filename=`"$($art.img)`"$LF" + "Content-Type: image/png$LF$LF"
    $fb=$enc.GetBytes($fp); $ms.Write($fb,0,$fb.Length); $ms.Write($ib,0,$ib.Length)
    $ms.Write($enc.GetBytes($LF),0,$enc.GetBytes($LF).Length)
  }
  
  $cl="--$boundary--$LF"; $cb=$enc.GetBytes($cl); $ms.Write($cb,0,$cb.Length)
  
  try {
    $r = Invoke-WebRequest -Uri "$base/admin/articles/save" -Method POST -Body $ms.ToArray() -ContentType "multipart/form-data; boundary=$boundary" -WebSession $session -MaximumRedirection 5 -UseBasicParsing
    if ($r.StatusCode -eq 200 -or $r.BaseResponse.ResponseUri -match "/admin/articles") {
      Write-Host "  ✅ Done"
      $ok++
    } else {
      Write-Host "  ⚠️ Status: $($r.StatusCode)"
    }
  } catch { 
    Write-Host "  ❌ $_" 
  }
}
Write-Host "`n✅ Published $ok / $($articles.Count) articles successfully!"
