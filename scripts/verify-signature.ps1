param([Parameter(Mandatory = $true)][string]$PackagePath)
$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath $PackagePath
if ($signature.Status -ne 'Valid') {
    throw "MSIX signature verification failed: $($signature.Status)"
}
[pscustomobject]@{
    status = 'Valid'
    subject = $signature.SignerCertificate.Subject
    thumbprint = $signature.SignerCertificate.Thumbprint
} | ConvertTo-Json -Compress
