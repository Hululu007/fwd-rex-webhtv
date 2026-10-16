# push_to_github.ps1 —— 通过 GitHub API 把本目录同步到仓库（本机 github.com:443 被重置时的替代通道）
#
# 用法：
#   pwsh -File .\push_to_github.ps1
#   pwsh -File .\push_to_github.ps1 -Message "fix: xxx" -Repo "用户名/仓库名" -Branch main
#
# 凭据来源：Windows 凭据管理器里的 github.com 凭据（git credential fill），不落盘、不打印。

[CmdletBinding()]
param(
  [string]$Repo = "caiwenjie17-a11y/fwd-rex-webhtv",
  [string]$Branch = "main",
  [string]$Message = "chore: sync from local",
  [string]$Dir = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

$cred = @("protocol=https", "host=github.com", "") | & git credential fill 2>$null
$token = ($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=', ''
if (-not $token) { throw "未从凭据管理器取到 github.com 凭据" }
$headers = @{ Authorization = "Bearer $token"; 'User-Agent' = 'dsh'; Accept = 'application/vnd.github+json' }
$api = "https://api.github.com/repos/$Repo"

function Api {
  param([string]$Method, [string]$Url, $Body)
  $p = @{ Uri = $Url; Method = $Method; Headers = $headers; TimeoutSec = 120 }
  if ($null -ne $Body) {
    $p.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 12 -Compress))
    $p.ContentType = 'application/json; charset=utf-8'
  }
  return Invoke-RestMethod @p
}

# 1) 当前分支 HEAD（空仓库会 404/409）
$headSha = $null
$baseTree = $null
try {
  $ref = Api GET "$api/git/ref/heads/$Branch"
  $headSha = $ref.object.sha
  $baseTree = (Api GET "$api/git/commits/$headSha").tree.sha
} catch {
  Write-Host "分支不存在，先做一次 bootstrap 提交（GitHub 不允许空仓库直接建 blob）"
  $boot = Api PUT "$api/contents/.bootstrap" @{
    message = 'chore: bootstrap'; branch = $Branch
    content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("bootstrap`n"))
  }
  $headSha = $boot.commit.sha
  $baseTree = (Api GET "$api/git/commits/$headSha").tree.sha
}

# 2) 扫描目录 → blobs（跳过 .git 和本脚本自身之外的东西都不跳，保持仓库即目录镜像）
$files = Get-ChildItem $Dir -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch '\\\.git\\' } |
  Sort-Object FullName

$tree = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($Dir.Length + 1).Replace('\', '/')
  $blob = Api POST "$api/git/blobs" @{
    content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName)); encoding = 'base64'
  }
  $tree += @{ path = $rel; mode = '100644'; type = 'blob'; sha = $blob.sha }
  Write-Host ("  blob {0} ({1} B)" -f $rel, $f.Length)
}
# 顺手删掉 bootstrap 占位文件
$tree += @{ path = '.bootstrap'; mode = '100644'; type = 'blob'; sha = $null }

# 3) tree → commit → 快进 ref
$treeRes = Api POST "$api/git/trees" @{ base_tree = $baseTree; tree = @($tree) }
$commit = Api POST "$api/git/commits" @{ message = $Message; tree = $treeRes.sha; parents = @($headSha) }
if ($headSha -eq $commit.parents[0]) { }
Api PATCH "$api/git/refs/heads/$Branch" @{ sha = $commit.sha; force = $false } | Out-Null

$token = $null
$now = Api GET "$api/commits/$Branch"
Write-Host ""
Write-Host ("已推送 {0} 个文件 → {1}@{2}" -f $files.Count, $Repo, $Branch)
Write-Host ("HEAD: {0}  {1}" -f $now.sha.Substring(0, 10), $now.commit.message)
Write-Host ("点播链接: https://raw.githubusercontent.com/{0}/{1}/vod.json" -f $Repo, $Branch)
Write-Host ("jsDelivr: https://cdn.jsdelivr.net/gh/{0}@{1}/vod.json" -f $Repo, $Branch)
