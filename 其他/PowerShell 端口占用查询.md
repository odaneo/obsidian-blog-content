
```powershell
netstat -aon | FindStr ":5432"
```

```powershell
Get-Process -Id 1234
```

或者

```bash
Get-NetTCPConnection -LocalPort 3306 | Select-Object -Expand OwningProcess | Sort-Object -Unique | ForEach-Object { Get-Process -Id $_ }
```
