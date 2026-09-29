# Bygger skabelonen til Visio-eksporten ud fra Cornerstones' stencil
# ("Process Diagram - Stencil.vssx"). Kræver Visio på maskinen — køres kun
# når stencilet ændres, ikke når appen kører.
#
#   powershell -ExecutionPolicy Bypass -File scripts/visio/build-stencil-template.ps1 -Stencil "<sti til .vssx>" -Out "<sti>\stencil-ref.vsdx"
#   npx tsx scripts/visio/extract-stencil-template.ts "<sti>\stencil-ref.vsdx"
#
# Visio lægger én figur af hver slags på en side (start, slut, timer,
# aktivitet i fire højder, de fire gateways, sekvens- og beskedpil) og
# gemmer. Figurerne er formelstyrede grupper, og Visio regner ikke
# formlerne om når en fil åbnes — derfor skal de ligge i filen præcis som
# Visio selv gemmer dem. Bagefter trækker extract-stencil-template.ts
# figurerne og masterne ud til src/lib/visio/stencil.
#
# Kør scriptet i sin egen proces (powershell -File ...): en usynlig Visio
# kan hænge, hvis den startes fra en shell der ikke pumper beskeder.
param(
  [Parameter(Mandatory = $true)][string]$Stencil,
  [string]$Out = (Join-Path $env:TEMP "corner-iq-stencil-ref.vsdx")
)
$log = [IO.Path]::ChangeExtension($Out, ".log")
function Step($s) { Add-Content $log ((Get-Date -Format "HH:mm:ss") + " " + $s) -Encoding utf8 }
Set-Content $log "" -Encoding utf8

$v = New-Object -ComObject Visio.InvisibleApp
$v.AlertResponse = 1
try {
  Step "visio startet"
  $doc = $v.Documents.Add("")
  # Stencilet åbnes direkte og skrivebeskyttet — en fil der lige er
  # kopieret, kan Visio hænge på at åbne i en usynlig instans.
  $st = $v.Documents.OpenEx($Stencil, 2 + 64)
  $pg = $doc.Pages.Item(1)
  Step "stencil åbnet"
  $M = @{}
  foreach ($n in "Start-End", "Time event", "Activity", "Gateway-split", "Parellel", "Inclusive Gateway", "Sequence Flow", "Message Flow") {
    $M[$n] = $st.Masters.ItemU($n)
  }

  $start = $pg.Drop($M["Start-End"], 1, 9); $start.Text = "Start"; $start.NameU = "REF_START"
  $end = $pg.Drop($M["Start-End"], 2, 9); $end.Text = "Slut"; $end.NameU = "REF_END"
  $end.CellsU("Prop.BpmnEventType").FormulaU = '"Slut"'
  $timer = $pg.Drop($M["Time event"], 3, 9); $timer.NameU = "REF_TIMER"
  Step "start/slut/timer"

  # Aktiviteter i fire højder (bredden er stencilets egen).
  $x = 1
  foreach ($h in 76, 100, 124, 148) {
    $a = $pg.Drop($M["Activity"], $x, 6); $a.Text = "Aktivitet"; $a.NameU = "REF_TASK_$h"
    $a.CellsU("Height").ResultIU = $h / 96
    $x += 1.5
  }
  Step "aktiviteter"

  $gx = $pg.Drop($M["Gateway-split"], 1, 3); $gx.NameU = "REF_GW_X"
  $gp = $pg.Drop($M["Parellel"], 2, 3); $gp.NameU = "REF_GW_P"
  $gi = $pg.Drop($M["Inclusive Gateway"], 3, 3); $gi.NameU = "REF_GW_O"
  $ge = $pg.Drop($M["Gateway-split"], 4, 3); $ge.NameU = "REF_GW_E"
  # Gatewaytypen styres normalt af Visios BPMN-tilføjelse (handlingerne er
  # REF()), så markeringen sættes direkte; Visio regner figuren om med det samme.
  $ge.CellsU("Actions.ExclusiveData.Checked").FormulaU = "0"
  $ge.CellsU("Actions.ExclusiveEvent.Checked").FormulaU = "1"
  Step "gateways"

  $sq = $pg.Drop($M["Sequence Flow"], 1, 1); $sq.NameU = "REF_SEQ"
  $sq.CellsU("BeginX").GlueTo($start.CellsU("PinX")); $sq.CellsU("EndX").GlueTo($gx.CellsU("PinX")); $sq.Text = "Ja"
  $mf = $pg.Drop($M["Message Flow"], 2, 1); $mf.NameU = "REF_MSG"
  $mf.CellsU("BeginX").GlueTo($gp.CellsU("PinX")); $mf.CellsU("EndX").GlueTo($end.CellsU("PinX"))
  Step "pile"

  $pg.Export([IO.Path]::ChangeExtension($Out, ".png"))
  $doc.SaveAs($Out)
  $st.Close(); $doc.Close()
  Step "gemt: $Out"
} catch {
  Step "FEJL: $($_.Exception.Message)"
} finally {
  $v.Quit()
}
