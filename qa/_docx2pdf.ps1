# Convert a .docx to PDF using the installed Word (COM automation).
# QA-only: lets us look at the Word output the same way we look at the PDF output.
# Usage: powershell -ExecutionPolicy Bypass -File qa/_docx2pdf.ps1 -In a.docx -Out a.pdf
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = "Stop"
$In = (Resolve-Path $In).Path
$Out = [System.IO.Path]::GetFullPath($Out)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($In, [ref]$false, [ref]$true)   # ConfirmConversions=false, ReadOnly=true
  # Fill in TOC page numbers and any other fields, exactly as a user clicking "Yes" would.
  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  $doc.Repaginate()
  $doc.SaveAs([ref]$Out, [ref]17)                              # 17 = wdFormatPDF
  $pages = $doc.ComputeStatistics(2)                           # 2 = wdStatisticPages
  Write-Output "PAGES=$pages"
  $doc.Close([ref]$false)
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
