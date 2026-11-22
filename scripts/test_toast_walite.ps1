[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$textNodes = $template.GetElementsByTagName('text')
$textNodes.Item(0).AppendChild($template.CreateTextNode('Tes Notifikasi WaLite')) | Out-Null
$textNodes.Item(1).AppendChild($template.CreateTextNode('Halo! Ini tes notifikasi Windows')) | Out-Null
try {
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('id.my.vianto06.walite')
    $notifier.Show([Windows.UI.Notifications.ToastNotification]::new($template))
    Write-Host "Success with id.my.vianto06.walite"
} catch {
    Write-Host "Failed with id.my.vianto06.walite: $_"
}
