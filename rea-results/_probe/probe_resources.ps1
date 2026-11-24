# probe_resources.ps1
# Script 1 of 2 in _probe: Mengukur resource (RAM/CPU, jumlah proses WebView2) dan storage untuk TARGET A, TARGET B, dan WhatsApp Web.

param(
    [int]$SampleSeconds = 5
)

function Get-ProcessTree($rootPid) {
    $all = Get-CimInstance Win32_Process
    $rootPidInt = [int]$rootPid
    $lookup = @{}
    foreach ($p in $all) {
        $ppid = [int]$p.ParentProcessId
        if (-not $lookup.ContainsKey($ppid)) {
            $lookup[$ppid] = [System.Collections.Generic.List[object]]::new()
        }
        $lookup[$ppid].Add($p)
    }

    $result = [System.Collections.Generic.List[object]]::new()
    $root = $all | Where-Object { [int]$_.ProcessId -eq $rootPidInt }
    if ($root) {
        $result.Add($root)
        $queue = [System.Collections.Queue]::new()
        $queue.Enqueue($rootPidInt)
        while ($queue.Count -gt 0) {
            $curr = [int]$queue.Dequeue()
            if ($lookup.ContainsKey($curr)) {
                foreach ($c in $lookup[$curr]) {
                    $result.Add($c)
                    $queue.Enqueue([int]$c.ProcessId)
                }
            }
        }
    }
    return $result
}

function Measure-AppResources($name, $pids) {
    if (-not $pids -or $pids.Count -eq 0) {
        return [PSCustomObject]@{
            App = $name
            Status = "Not Running"
            ProcessCount = 0
            TotalWS_MB = 0
            TotalPrivate_MB = 0
            AvgCpuPct = 0
            Pids = ""
        }
    }

    $procs = Get-Process -Id $pids -ErrorAction SilentlyContinue
    if (-not $procs) {
        return [PSCustomObject]@{
            App = $name
            Status = "Terminated"
            ProcessCount = 0
            TotalWS_MB = 0
            TotalPrivate_MB = 0
            AvgCpuPct = 0
            Pids = ""
        }
    }

    $count = $procs.Count
    $totalWS = [math]::Round(($procs | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB, 2)
    $totalPrivate = [math]::Round(($procs | Measure-Object -Property PrivateMemorySize64 -Sum).Sum / 1MB, 2)

    # Sample CPU usage over $SampleSeconds
    $cpu1 = @{}
    foreach ($p in $procs) {
        $cpu1[$p.Id] = $p.CPU
    }
    Start-Sleep -Seconds $SampleSeconds
    $procs2 = Get-Process -Id $pids -ErrorAction SilentlyContinue
    $totalCpuSec = 0
    foreach ($p in $procs2) {
        if ($cpu1.ContainsKey($p.Id) -and $p.CPU -ne $null -and $cpu1[$p.Id] -ne $null) {
            $diff = $p.CPU - $cpu1[$p.Id]
            if ($diff -gt 0) { $totalCpuSec += $diff }
        }
    }
    $cpuPct = [math]::Round(($totalCpuSec / ($SampleSeconds * [Environment]::ProcessorCount)) * 100, 2)

    return [PSCustomObject]@{
        App = $name
        Status = "Running"
        ProcessCount = $count
        TotalWS_MB = $totalWS
        TotalPrivate_MB = $totalPrivate
        AvgCpuPct = $cpuPct
        Pids = ($pids -join ", ")
    }
}

Write-Host "=== 1. PENGUKURAN RESOURCE MEMORI DAN CPU (Idle $SampleSeconds Detik) ==="

# 1. Walite (TARGET B)
$waliteProc = Get-Process -Name "walite" -ErrorAction SilentlyContinue | Select-Object -First 1
$waliteTree = @()
if ($waliteProc) {
    $waliteTree = Get-ProcessTree $waliteProc.Id
}
$walitePids = $waliteTree | ForEach-Object { $_.ProcessId }
$waliteRes = Measure-AppResources "Walite (TARGET B)" $walitePids

# 2. WhatsApp Desktop resmi (TARGET A)
$waDeskProcs = Get-Process -Name "WhatsApp.Root", "WhatsApp" -ErrorAction SilentlyContinue
$waDeskPids = @()
if ($waDeskProcs) {
    foreach ($wp in $waDeskProcs) {
        $tree = Get-ProcessTree $wp.Id
        $waDeskPids += ($tree | ForEach-Object { $_.ProcessId })
    }
    $waDeskPids = $waDeskPids | Select-Object -Unique
}
$waDeskRes = Measure-AppResources "WhatsApp Desktop (TARGET A)" $waDeskPids

# 3. Browser WhatsApp Web (Cek Edge/Chrome/Brave)
$browserWAPids = @()
$browserProcs = Get-Process -Name "msedge", "chrome", "brave" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "WhatsApp" -or $_.MainWindowTitle -match "web.whatsapp" }
if (-not $browserProcs) {
    # Check by command line or specific test profile
    $allEdge = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*edge_wa_probe*" -or $_.CommandLine -like "*web.whatsapp.com*" }
    $rootEdge = $allEdge | Where-Object { $_.ParentProcessId -notmatch ( ($allEdge.ProcessId) -join "|" ) }
    if ($rootEdge) {
        foreach ($re in $rootEdge) {
            $tree = Get-ProcessTree $re.ProcessId
            $browserWAPids += ($tree | ForEach-Object { $_.ProcessId })
        }
    }
} else {
    foreach ($bp in $browserProcs) {
        $tree = Get-ProcessTree $bp.Id
        $browserWAPids += ($tree | ForEach-Object { $_.ProcessId })
    }
}
$browserWAPids = $browserWAPids | Select-Object -Unique
$browserWARes = Measure-AppResources "WhatsApp Web (Browser)" $browserWAPids

$allResults = @($waliteRes, $waDeskRes, $browserWARes)
$allResults | Format-Table -AutoSize

Write-Host "`n=== 2. DETAIL PROSES WALITE (WEBVIEW2 SUBPROCESSES) ==="
if ($waliteTree) {
    $waliteTree | ForEach-Object {
        $cmd = $_.CommandLine
        $type = "Main / Rust Host"
        if ($cmd -match "--type=([^\s]+)") { $type = $matches[1] }
        elseif ($_.Name -like "*webview*") { $type = "Browser Main Core" }
        [PSCustomObject]@{
            ProcessId = $_.ProcessId
            Name = $_.Name
            Type = $type
            WorkingSet_MB = [math]::Round($_.WorkingSetSize / 1MB, 2)
        }
    } | Format-Table -AutoSize
}

Write-Host "`n=== 3. INVENTARIS STORAGE WHATSAPP ==="
# A. WhatsApp Desktop (TARGET A) Storage
$waLocalState = "$env:LOCALAPPDATA\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm\LocalState"
if (Test-Path $waLocalState) {
    Write-Host "[TARGET A] WhatsApp Desktop LocalState:"
    Get-ChildItem -Path $waLocalState | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
}

# B. Walite (TARGET B) Storage
$waliteDataDir = "$env:LOCALAPPDATA\id.my.vianto06.walite\data"
if (-not (Test-Path $waliteDataDir)) {
    $waliteDataDir = "$env:LOCALAPPDATA\id.my.vianto06.walite\EBWebView"
}
if (Test-Path $waliteDataDir) {
    Write-Host "[TARGET B] Walite Storage ($waliteDataDir):"
    $idb = "$waliteDataDir\EBWebView\Default\IndexedDB"
    if (Test-Path $idb) {
        Write-Host "  IndexedDB:"
        Get-ChildItem -Path $idb | Select-Object Name, LastWriteTime | Format-Table -AutoSize
    }
    $ls = "$waliteDataDir\EBWebView\Default\Local Storage\leveldb"
    if (Test-Path $ls) {
        Write-Host "  Local Storage (leveldb files): $((Get-ChildItem -Path $ls).Count) files"
    }
    $sw = "$waliteDataDir\EBWebView\Default\Service Worker"
    if (Test-Path $sw) {
        Write-Host "  Service Worker Subdirectories: $((Get-ChildItem -Path $sw).Name -join ', ')"
    }
}
