param(
  [Parameter(Mandatory = $true)][string]$OutPath,
  [Parameter(Mandatory = $true)][ValidateSet('icon', 'foreground', 'splash', 'favicon', 'monochrome')][string]$Kind,
  [int]$Size = 1024
)

Add-Type -AssemblyName System.Drawing

# Warm near-black + the dark-scheme accent, matching the `dark` entry of
# `colors` in src/theme/tokens.ts. Keep these in step with that record.
$Midnight = [System.Drawing.ColorTranslator]::FromHtml('#0F0E0D')
$Accent   = [System.Drawing.ColorTranslator]::FromHtml('#E0855A')
$White    = [System.Drawing.Color]::White

# Supersample, then downscale: System.Drawing has no proper gradient/antialias
# story for rounded rects at small sizes, and this removes the stair-stepping.
$SS = 4
$Big = $Size * $SS

$bitmap  = New-Object System.Drawing.Bitmap($Big, $Big)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::Transparent)

# Opaque plates only where the platform expects a full-bleed background.
if ($Kind -eq 'icon' -or $Kind -eq 'favicon') {
  $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($Midnight)), 0, 0, $Big, $Big)
}

# The mark: three bottom-aligned bars of rising height. It reads as elapsed time
# and as a bar chart, which is the same idea as the Insights screen.
switch ($Kind) {
  'favicon'     { $markColor = $Accent; $markBox = 0.66 }
  'monochrome'  { $markColor = $White;  $markBox = 0.66 }
  'foreground'  { $markColor = $Accent; $markBox = 0.42 }  # adaptive safe zone
  'splash'      { $markColor = $Accent; $markBox = 0.46 }
  default       { $markColor = $Accent; $markBox = 0.54 }
}

$box    = [int]($Big * $markBox)
$left   = [int](($Big - $box) / 2)
$bottom = [int](($Big + $box) / 2)

$barWidth  = [int]($box * 0.19)
$gap       = [int]($box * 0.11)
$radius    = [int]($barWidth * 0.42)
$totalBars = ($barWidth * 3) + ($gap * 2)
$x         = [int](($Big - $totalBars) / 2)

# Heights as a fraction of the mark box.
$heights = @(0.36, 0.60, 0.84)
$brush   = New-Object System.Drawing.SolidBrush($markColor)

foreach ($ratio in $heights) {
  $h = [int]($box * $ratio)
  $y = $bottom - $h
  $graphics.FillRectangle($brush, $x, $y, $barWidth, $h)
  $x += $barWidth + $gap
}

$graphics.Dispose()
$brush.Dispose()

# Downsample to the requested size.
$final = New-Object System.Drawing.Bitmap($Size, $Size)
$g2    = [System.Drawing.Graphics]::FromImage($final)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g2.Clear([System.Drawing.Color]::Transparent)
$g2.DrawImage($bitmap, 0, 0, $Size, $Size)
$g2.Dispose()

$final.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$final.Dispose()
$bitmap.Dispose()

Write-Output "wrote $OutPath ($Kind, ${Size}px)"