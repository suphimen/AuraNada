; AuraNada — Inno Setup install script
; Filled in by scripts\dist-inno.js and compiled as build\AuraNada.inno.iss.

#define AppVersion "3.2.0"

[Setup]
AppId={{06E4F53C-A1EE-4F0E-9B8A-0F3E2D9C5B31}
AppName=AuraNada
AppVersion=3.2.0
AppVerName=AuraNada 3.2.0
AppPublisher=AuraNada
DefaultDirName={localappdata}\Programs\AuraNada
DefaultGroupName=AuraNada
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
OutputDir=@@OUTPUTDIR@@
OutputBaseFilename=AuraNada Setup 3.2.0
SetupIconFile=@@SETUPICON@@
UninstallDisplayIcon={app}\AuraNada.exe
UninstallDisplayName=AuraNada
VersionInfoVersion=3.2.0
VersionInfoProductName=AuraNada
VersionInfoProductVersion=3.2.0
VersionInfoCompany=AuraNada
VersionInfoDescription=AuraNada
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
CloseApplicationsFilter=AuraNada.exe,ffmpeg.exe,ffprobe.exe
RestartApplications=no
SignTool=aurasign
SignedUninstaller=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"

[Files]
Source: "@@APPSRCDIR@@\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\AuraNada\AuraNada"; Filename: "{app}\AuraNada.exe"; WorkingDir: "{app}"; IconFilename: "{app}\AuraNada.exe"
Name: "{userprograms}\AuraNada\AuraNada User Guide"; Filename: "{app}\resources\USER_GUIDE.txt"; IconFilename: "{app}\AuraNada.exe"
Name: "{userprograms}\AuraNada\Uninstall AuraNada"; Filename: "{uninstallexe}"
Name: "{userdesktop}\AuraNada"; Filename: "{app}\AuraNada.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\AuraNada.exe"; Description: "Launch AuraNada now"; Flags: nowait postinstall skipifsilent

[InstallDelete]
Type: filesandordirs; Name: "{userprograms}\AuraNada"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: filesandordirs; Name: "{userappdata}\AuraNada"
Type: filesandordirs; Name: "{userappdata}\auranada"
Type: filesandordirs; Name: "{localappdata}\AuraNada"
Type: filesandordirs; Name: "{localappdata}\auranada"
Type: files; Name: "{localappdata}\Temp\AuraNada_preview_*"
Type: dirifempty; Name: "{userprograms}\AuraNada"

[Code]
function EsksNsisTemizle(): Boolean;
var
  eskiUn: string;
  kod: Integer;
  i: Integer;
  isim: string;
  taban: string;
  baslik: string;
  kaldir: string;
  listeler: TArrayOfString;
begin
  Result := true;

  if RegGetSubkeyNames(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall', listeler) then
  begin
    for i := 0 to GetArrayLength(listeler) - 1 do
    begin
      isim := listeler[i];
      taban := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\' + isim;
      if RegQueryStringValue(HKCU, taban, 'DisplayName', baslik) then
      begin
        if Pos('AuraNada', baslik) > 0 then
        begin
          if RegQueryStringValue(HKCU, taban, 'UninstallString', kaldir) then
          begin
            if Pos('Uninstall AuraNada.exe', kaldir) > 0 then
              RegDeleteKeyIncludingSubkeys(HKCU, taban);
          end;
        end;
      end;
    end;
  end;

  eskiUn := ExpandConstant('{app}\Uninstall AuraNada.exe');
  if FileExists(eskiUn) then
  begin
    if not Exec(eskiUn, '/S', '', SW_HIDE, ewWaitUntilTerminated, kod) then
      DeleteFile(eskiUn);
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  EsksNsisTemizle();
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  kod: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec('taskkill.exe', '/F /T /IM AuraNada.exe', '', SW_HIDE, ewWaitUntilTerminated, kod);
    Exec('taskkill.exe', '/F /T /IM ffmpeg.exe', '', SW_HIDE, ewWaitUntilTerminated, kod);
    Exec('taskkill.exe', '/F /T /IM ffprobe.exe', '', SW_HIDE, ewWaitUntilTerminated, kod);
  end;
end;