param(
    [string]$Title = "SCM Control Tower",
    [string]$Message = "Tes notifikasi Windows Desktop berjalan sukses!"
)

try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $toastXml = [xml]$template.GetXml()
    $textNodes = $toastXml.GetElementsByTagName("text")
    $textNodes[0].AppendChild($toastXml.CreateTextNode($Title)) | Out-Null
    $textNodes[1].AppendChild($toastXml.CreateTextNode($Message)) | Out-Null
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($toastXml.OuterXml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("SCM Control Tower").Show($toast)
    Write-Output "TOAST_SUCCESS"
} catch {
    # Fallback to msg command or balloon if WinRT is unavailable
    Write-Output "WINRT_ERROR: $($_.Exception.Message)"
}
