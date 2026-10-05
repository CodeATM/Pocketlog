Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class MarkScanner {
    public class Result {
        public int MinX, MaxX, MinY, MaxY;
        public int AccentHits;
        public int InkHits;
        public long[] Corners;   // ARGB at four inset corners
    }

    /// <summary>
    /// Scans the bitmap once for the bounding box of "ink" and for pixels close to
    /// the brand colour. Done in C# because a per-pixel loop over ~1M pixels is
    /// unusable from PowerShell.
    ///
    /// Opaque plates treat anything meaningfully different from the background
    /// colour as ink; transparent assets use alpha as the ink test.
    /// </summary>
    public static Result Scan(string path, bool opaque,
                              int bgR, int bgG, int bgB, int bgTolerance,
                              int accentR, int accentG, int accentB, int accentTolerance) {
        using (Bitmap source = new Bitmap(path)) {
            using (Bitmap bmp = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(bmp)) {
                    g.DrawImageUnscaled(source, 0, 0);
                }

                int width = bmp.Width, height = bmp.Height;
                Rectangle rect = new Rectangle(0, 0, width, height);
                BitmapData data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);

                int stride = data.Stride;
                int inset = Math.Max(1, width / 100);

                // Copied into a managed array so the scan needs no unsafe code.
                byte[] pixels = new byte[stride * height];
                Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
                bmp.UnlockBits(data);

                Result result = new Result {
                    MinX = width, MinY = height, MaxX = -1, MaxY = -1,
                    AccentHits = 0, Corners = new long[4]
                };

                for (int y = 0; y < height; y++) {
                    int rowStart = y * stride;
                    for (int x = 0; x < width; x++) {
                        int i = rowStart + x * 4;
                        int b = pixels[i + 0];
                        int g2 = pixels[i + 1];
                        int r = pixels[i + 2];
                        int a = pixels[i + 3];

                        bool isInk;
                        if (opaque) {
                            isInk = !(Math.Abs(r - bgR) <= bgTolerance &&
                                       Math.Abs(g2 - bgG) <= bgTolerance &&
                                       Math.Abs(b - bgB) <= bgTolerance);
                        } else {
                            isInk = a > 128;
                        }

                        if (isInk) {
                            result.InkHits++;
                            if (x < result.MinX) result.MinX = x;
                            if (x > result.MaxX) result.MaxX = x;
                            if (y < result.MinY) result.MinY = y;
                            if (y > result.MaxY) result.MaxY = y;
                        }

                        if (a > 200 &&
                            Math.Abs(r - accentR) <= accentTolerance &&
                            Math.Abs(g2 - accentG) <= accentTolerance &&
                            Math.Abs(b - accentB) <= accentTolerance) {
                            result.AccentHits++;
                        }
                    }
                }

                result.Corners[0] = Pack(pixels, stride, inset, inset);
                result.Corners[1] = Pack(pixels, stride, inset, height - 1 - inset);
                result.Corners[2] = Pack(pixels, stride, width - 1 - inset, inset);
                result.Corners[3] = Pack(pixels, stride, width - 1 - inset, height - 1 - inset);

                return result;
            }
        }
    }

    private static long Pack(byte[] pixels, int stride, int x, int y) {
        int i = y * stride + x * 4;
        return ((long)pixels[i + 2] << 16) | ((long)pixels[i + 1] << 8) | pixels[i];
    }
}
'@ -ReferencedAssemblies System.Drawing

$Midnight = @{ R = 0x0F; G = 0x0E; B = 0x0D }
$Accent   = @{ R = 0xE0; G = 0x85; B = 0x5A }
$White    = @{ R = 0xFF; G = 0xFF; B = 0xFF }

$assets = @(
  @{ Path = 'assets\icon.png';                   Opaque = $true;  Color = 'Accent'; SafeZone = $null }
  @{ Path = 'assets\android-icon-foreground.png'; Opaque = $false; Color = 'Accent'; SafeZone = 0.66 }
  @{ Path = 'assets\android-icon-monochrome.png'; Opaque = $false; Color = 'White';  SafeZone = 0.66 }
  @{ Path = 'assets\splash-icon.png';             Opaque = $false; Color = 'Accent'; SafeZone = $null }
  @{ Path = 'assets\favicon.png';                 Opaque = $true;  Color = 'Accent'; SafeZone = $null }
)

$failed = $false

foreach ($asset in $assets) {
  # NB: must not be named `$accent` — PowerShell variables are case-insensitive, so
  # that would collide with the `$Accent` palette entry above and be overwritten by
  # the monochrome asset.
  $expected = if ($asset.Color -eq 'White') { $White } else { $Accent }
  $path = (Resolve-Path $asset.Path).Path

  $scan = [MarkScanner]::Scan(
    $path, [bool]$asset.Opaque,
    $Midnight.R, $Midnight.G, $Midnight.B, 10,
    $expected.R, $expected.G, $expected.B, 6
  )

  $size = (Get-Item $path).Length
  $problems = @()

  # Bitmap dimensions, read separately from the scan.
  Add-Type -AssemblyName System.Drawing
  $bmp = [System.Drawing.Image]::FromFile($path)
  $width = $bmp.Width; $height = $bmp.Height
  $bmp.Dispose()

  if ($scan.MaxX -lt 0) {
    $problems += 'no mark was drawn'
  } else {
    $markWidth  = $scan.MaxX - $scan.MinX + 1
    $markHeight = $scan.MaxY - $scan.MinY + 1

    $centerOffsetX = [Math]::Abs(($scan.MinX + $scan.MaxX) / 2 - ($width / 2))
    if ($centerOffsetX -gt 2) {
      $problems += "mark is off-centre horizontally by $([Math]::Round($centerOffsetX, 1))px"
    }

    # Nothing may run off the canvas.
    foreach ($edge in @($scan.MinX, $scan.MinY, ($width - 1 - $scan.MaxX), ($height - 1 - $scan.MaxY))) {
      if ($edge -le 0) { $problems += 'mark touches the canvas edge and would be clipped' }
    }

    if (($markWidth / $width) -gt 0.85)  { $problems += "mark is $([Math]::Round($markWidth / $width * 100))% wide" }
    if (($markHeight / $height) -gt 0.90) { $problems += "mark is $([Math]::Round($markHeight / $height * 100))% tall" }

    # The bars rise from a shared baseline, so the ink bottom is the baseline and
    # must sit below the vertical midpoint.
    $baseline = $scan.MaxY / $height
    if ($baseline -lt 0.55) {
      $problems += "baseline sits at $([Math]::Round($baseline * 100))% height, too high"
    }

    if ($asset.SafeZone) {
      $margin = [Math]::Min([Math]::Min($scan.MinX, $scan.MinY),
                            [Math]::Min($width - 1 - $scan.MaxX, $height - 1 - $scan.MaxY))
      $marginRatio = $margin / $width
      $required = (1 - $asset.SafeZone) / 2
      if ($marginRatio -lt ($required - 0.01)) {
        $problems += "mark margin is $([Math]::Round($marginRatio * 100))%, needs $([Math]::Round($required * 100))% for the safe zone"
      }
    }

    if ($scan.AccentHits -lt 200 -and $scan.InkHits -gt 0) {
      # Small assets blend their edges, so a fixed pixel count is meaningless.
      # Instead require the brand colour to dominate the ink it was drawn in.
      $accentShare = $scan.AccentHits / $scan.InkHits
      if ($accentShare -lt 0.2) {
        $problems += ("only {0:P0} of the mark is the brand colour ({1} accent px of {2} ink px)" -f $accentShare, $scan.AccentHits, $scan.InkHits)
      }
    } elseif ($scan.InkHits -eq 0) {
      $problems += 'the mark has no ink'
    }
  }

  if ($asset.Opaque) {
    # Inset corners must still be Midnight, proving the plate was actually filled.
    foreach ($corner in $scan.Corners) {
      $r = ($corner -shr 16) -band 0xFF
      $g = ($corner -shr 8) -band 0xFF
      $b = $corner -band 0xFF
      if ([Math]::Abs($r - $Midnight.R) -gt 6 -or
          [Math]::Abs($g - $Midnight.G) -gt 6 -or
          [Math]::Abs($b - $Midnight.B) -gt 6) {
        $problems += "inset corner is #{0:X2}{1:X2}{2:X2}, expected Midnight" -f $r, $g, $b
      }
    }
  }

  if ($problems.Count -gt 0) {
    $failed = $true
    Write-Output "FAIL  $($asset.Path)"
    $problems | ForEach-Object { Write-Output "        $_" }
  } else {
    Write-Output ("PASS  {0}  ({1}x{2}, {3} accent of {4} ink px, {5} KB)" -f $asset.Path, $width, $height, $scan.AccentHits, $scan.InkHits, [Math]::Round($size / 1KB, 1))
  }
}

if ($failed) { exit 1 }
Write-Output ''
Write-Output 'All brand assets verified.'