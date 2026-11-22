[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$textNodes = $template.GetElementsByTagName('text')
$textNodes.Item(0).AppendChild($template.CreateTextNode('Tes Notifikasi WaLite')) | Out-Null
$textNodes.Item(1).AppendChild($template.CreateTextNode('Halo! Ini tes notifikasi Windows')) | Out-Null
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe')
$notifier.Show([Windows.UI.Notifications.ToastNotification]::new($template))
Write-Host "Toast dispatched successfully"
