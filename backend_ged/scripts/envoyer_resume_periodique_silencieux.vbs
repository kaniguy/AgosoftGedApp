' Lance le resume periodique GED sans fenetre.
' Chemins derives du dossier de ce script (backend_ged\scripts), portable.
Option Explicit
Dim fso, shell, scriptsDir, batPath
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptsDir & "\envoyer_resume_periodique.bat"
' 0 = fenetre cachee, False = ne pas attendre la fin
shell.Run """" & batPath & """", 0, False
