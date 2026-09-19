!macro customInstall
  ; --- Clean up leftover shortcuts from old versions ---
  Delete "$SMPROGRAMS\AuraNada\AuraNada.txt.lnk"
  Delete "$SMPROGRAMS\AuraNada\AuraNada.txt"
  Delete "$SMPROGRAMS\AuraNada\uninstall.lnk"
  Delete "$SMPROGRAMS\AuraNada\Uninstall AuraNada.lnk"
  ; --- AuraNada Start Menu shortcuts ---
  CreateDirectory "$SMPROGRAMS\AuraNada"
  CreateShortCut "$SMPROGRAMS\AuraNada\AuraNada.lnk" "$INSTDIR\AuraNada.exe" "" "$INSTDIR\AuraNada.exe" 0
  ; Application (electron-builder adds it itself; left empty)
  ; User Guide
  CreateShortCut "$SMPROGRAMS\AuraNada\AuraNada User Guide.lnk" "$INSTDIR\resources\USER_GUIDE.txt" "" "$INSTDIR\resources\USER_GUIDE.txt" 0
  ; Uninstall
  CreateShortCut "$SMPROGRAMS\AuraNada\Uninstall AuraNada.lnk" "$INSTDIR\Uninstall AuraNada.exe" "" "$INSTDIR\Uninstall AuraNada.exe" 0
!macroend

!macro customUnInstall
  ; --- Start menu: clear all shortcuts and old leftovers ---
  RMDir /r "$SMPROGRAMS\AuraNada"
  ; --- App data (part of %APPDATA%\AuraNada is deleted by electron-builder; extra assurance) ---
  RMDir /r "$APPDATA\AuraNada"
  RMDir /r "$APPDATA\auranada"
  RMDir /r "$LOCALAPPDATA\AuraNada"
  RMDir /r "$LOCALAPPDATA\auranada"
  ; --- A/B preview temp files (%TEMP%) ---
  Delete "$TEMP\AuraNada_preview_A.m4a"
  Delete "$TEMP\AuraNada_preview_B.m4a"
  Delete "$TEMP\AuraNada_preview_*.m4a"
  ; --- NSIS temporary uninstaller copies (%TEMP%\~nsu*.tmp) ---
  ; The NSIS uninstaller copies itself into %TEMP%\~nsu<random>.tmp and runs
  ; from there (so it can delete itself). These temporary copies are cleaned
  ; according to the zero-trace principle.
  ; A hidden wscript cleans until the folders are gone, then deletes itself.
  FileOpen $0 "$TEMP\AuraNada_uninst_tmp.vbs" w
FileWrite $0 'Option Explicit$\r$\n'
  FileWrite $0 'Dim fso, ws, tmp, inst, i, f, fl$\r$\n'
  FileWrite $0 'On Error Resume Next$\r$\n'
  FileWrite $0 'Set ws = CreateObject("WScript.Shell")$\r$\n'
  FileWrite $0 'Set fso = CreateObject("Scripting.FileSystemObject")$\r$\n'
  FileWrite $0 'tmp = ws.ExpandEnvironmentStrings("%TEMP%")$\r$\n'
  FileWrite $0 'ws.CurrentDirectory = tmp$\r$\n'
  FileWrite $0 'inst = "$INSTDIR"$\r$\n'
  FileWrite $0 'WScript.Sleep 2000$\r$\n'
  FileWrite $0 'Function NsuVarmi()$\r$\n'
  FileWrite $0 '  NsuVarmi = False$\r$\n'
  FileWrite $0 '  If fso.FolderExists(tmp) Then$\r$\n'
  FileWrite $0 '    For Each f In fso.GetFolder(tmp).SubFolders$\r$\n'
  FileWrite $0 '      If Left(f.Name, 4) = "~nsu" Then$\r$\n'
  FileWrite $0 '        For Each fl In fso.GetFolder(f.Path).Files$\r$\n'
  FileWrite $0 '          If UCase(Left(fl.Name, 3)) = "UN_" Then NsuVarmi = True : Exit For$\r$\n'
  FileWrite $0 '        Next$\r$\n'
  FileWrite $0 '      End If$\r$\n'
  FileWrite $0 '      If NsuVarmi Then Exit For$\r$\n'
  FileWrite $0 '    Next$\r$\n'
  FileWrite $0 '  End If$\r$\n'
  FileWrite $0 'End Function$\r$\n'
  FileWrite $0 'Sub NsuTemizle()$\r$\n'
  FileWrite $0 '  If fso.FolderExists(tmp) Then$\r$\n'
  FileWrite $0 '    For Each f In fso.GetFolder(tmp).SubFolders$\r$\n'
  FileWrite $0 '      If Left(f.Name, 4) = "~nsu" Then$\r$\n'
  FileWrite $0 '        Dim esle$\r$\n'
  FileWrite $0 '        esle = False$\r$\n'
  FileWrite $0 '        For Each fl In fso.GetFolder(f.Path).Files$\r$\n'
  FileWrite $0 '          If UCase(Left(fl.Name, 3)) = "UN_" Then esle = True : Exit For$\r$\n'
  FileWrite $0 '        Next$\r$\n'
  FileWrite $0 '        If esle Then f.Delete True$\r$\n'
  FileWrite $0 '      End If$\r$\n'
  FileWrite $0 '    Next$\r$\n'
  FileWrite $0 '  End If$\r$\n'
  FileWrite $0 'End Sub$\r$\n'
  FileWrite $0 'For i = 1 To 60$\r$\n'
  FileWrite $0 '  NsuTemizle$\r$\n'
  FileWrite $0 '  ws.Run "cmd /c rd /q ""$INSTDIR""", 0, True$\r$\n'
  FileWrite $0 '  If (Not NsuVarmi) And (Not fso.FolderExists(inst)) Then Exit For$\r$\n'
  FileWrite $0 '  WScript.Sleep 1500$\r$\n'
  FileWrite $0 'Next$\r$\n'
  FileWrite $0 'fso.DeleteFile WScript.ScriptFullName$\r$\n'
  FileClose $0
  Exec '"$WINDIR\System32\wscript.exe" "$TEMP\AuraNada_uninst_tmp.vbs"'
!macroend
