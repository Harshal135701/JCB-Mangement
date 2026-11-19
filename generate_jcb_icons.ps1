Add-Type -AssemblyName System.Drawing

$sizes = @(
    @{ folder = "mipmap-mdpi"; size = 48; fontSize = 16 },
    @{ folder = "mipmap-hdpi"; size = 72; fontSize = 24 },
    @{ folder = "mipmap-xhdpi"; size = 96; fontSize = 32 },
    @{ folder = "mipmap-xxhdpi"; size = 144; fontSize = 48 },
    @{ folder = "mipmap-xxxhdpi"; size = 192; fontSize = 64 }
)

$resDir = "D:\jcb project\jcb\mobile\android\app\src\main\res"

foreach ($item in $sizes) {
    $targetDir = Join-Path $resDir $item.folder
    if (!(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    $size = $item.size
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Official JCB Yellow Background: #F9B101
    $yellowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#F9B101"))
    $g.FillRectangle($yellowBrush, 0, 0, $size, $size)

    # Rounded rectangle inner badge or bold JCB Black text
    $font = New-Object System.Drawing.Font("Arial Black", $item.fontSize, [System.Drawing.FontStyle]::Bold)
    $blackBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
    $g.DrawString("JCB", $font, $blackBrush, $rect, $sf)

    $g.Dispose()

    # Save square icon
    $squarePath = Join-Path $targetDir "ic_launcher.png"
    $bmp.Save($squarePath, [System.Drawing.Imaging.ImageFormat]::Png)

    # Now create round icon
    $roundBmp = New-Object System.Drawing.Bitmap $size, $size
    $rg = [System.Drawing.Graphics]::FromImage($roundBmp)
    $rg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $rg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Fill transparent background
    $rg.Clear([System.Drawing.Color]::Transparent)

    # Draw circular JCB yellow background
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $size - 1, $size - 1)
    $rg.FillPath($yellowBrush, $path)

    # Draw black JCB text inside circle
    $rg.DrawString("JCB", $font, $blackBrush, $rect, $sf)

    $rg.Dispose()
    $roundPath = Join-Path $targetDir "ic_launcher_round.png"
    $roundBmp.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $roundBmp.Dispose()
    $bmp.Dispose()
    $yellowBrush.Dispose()
    $blackBrush.Dispose()
    $font.Dispose()
    $sf.Dispose()

    Write-Host "Generated JCB icons for $($item.folder) ($size x $size)"
}

