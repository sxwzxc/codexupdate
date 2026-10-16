param([Parameter(Mandatory = $true)][string]$PackagePath)
$ErrorActionPreference = 'Stop'
# pwsh-hosted GitHub jobs inherit a PSModulePath containing PowerShell 7 modules.
# Load the matching Windows PowerShell module explicitly instead of autoloading it.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -Force
$signature = Get-AuthenticodeSignature -LiteralPath $PackagePath
if ($signature.Status -ne 'Valid') {
    throw "MSIX signature verification failed: $($signature.Status)"
}
[pscustomobject]@{
    status = 'Valid'
    subject = $signature.SignerCertificate.Subject
    thumbprint = $signature.SignerCertificate.Thumbprint
} | ConvertTo-Json -Compress
