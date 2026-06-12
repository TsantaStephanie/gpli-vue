**MACOS**
find . -type f -mmin -30 -exec stat -f "%Sm %N" -t "%Y-%m-%d %H:%M:%S" {} \;

**LINUX**
find . -type f -mmin -30 -exec ls -lh {} \;

**WINDOWS**
Get-ChildItem C:\aaa -Recurse -File |
Where-Object {$_.LastWriteTime -gt (Get-Date).AddMinutes(-30)} |
Sort-Object LastWriteTime -Descending |
Select-Object LastWriteTime, FullName
