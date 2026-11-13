; MinePixel – Minecraft stílusú telepítő (Inno Setup 6)
; Előtte: build_installer.bat (vagy: npm run pack), ami létrehozza a dist\win-unpacked mappát.

#define AppName "MinePixel"
#define AppVersion "1.1.0"
#define AppExe "MinePixel.exe"

[Setup]
AppId={{7B3E5C1A-4D2F-4E8B-9A61-5A1C0DE00001}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=MinePixel
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=MinePixel_Setup_{#AppVersion}
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
WizardStyle=modern
WizardSizePercent=115
WizardImageFile=assets\wizard_large.bmp,assets\wizard_large@2x.bmp
WizardSmallImageFile=assets\wizard_small.bmp,assets\wizard_small@2x.bmp
Compression=lzma2/ultra
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
DisableWelcomePage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
SetupAppTitle=MinePixel telepítő
SetupWindowTitle=%1 telepítő
ButtonBack=< Vissza
ButtonNext=Tovább >
ButtonInstall=Telepítés
ButtonCancel=Mégse
ButtonBrowse=Tallózás...
ButtonOK=OK
ButtonYes=Igen
ButtonNo=Nem
ButtonFinish=Kész
WelcomeLabel1=Üdv a MinePixelben!
WelcomeLabel2=Ez a telepítő feltelepíti a MinePixel nevű kockás túlélőjátékot a gépedre.%n%nBányássz, építs, farmolj, és játssz a barátaiddal online!%n%nA folytatáshoz kattints a Tovább gombra.
WizardSelectDir=Hova telepítsük?
SelectDirDesc=Válaszd ki a MinePixel telepítési mappáját.
SelectDirLabel3=A játék ebbe a mappába kerül.
SelectDirBrowseLabel=A folytatáshoz kattints a Tovább gombra. Másik mappához a Tallózás gombot használd.
WizardSelectTasks=Extra beállítások
SelectTasksDesc=Mit állítsunk be még?
SelectTasksLabel2=Jelöld be, amit szeretnél, majd kattints a Tovább gombra.
WizardReady=Minden készen áll
ReadyLabel1=A telepítő készen áll a MinePixel telepítésére.
WizardInstalling=Blokkok lerakása...
InstallingLabel=Várj, amíg a MinePixel települ a gépedre.
FinishedHeadingLabel=A telepítés kész!
FinishedLabelNoIcons=A MinePixel sikeresen települt.
FinishedLabel=A MinePixel sikeresen települt. Indítsd el a parancsikonnal.
ClickFinish=A telepítő bezárásához kattints a Kész gombra.

[CustomMessages]
TaskDesktop=Parancsikon az asztalra
TaskFirewall=Multiplayer engedélyezése a tűzfalon (25566-os port)
TaskGroup=Egyéb:
RunGame=Indítsd el a MinePixelt most
DeleteSaves=Töröljem a mentett világokat is?%n%nIgen: minden világ és beállítás törlődik.%nNem: a mentések megmaradnak.

[Tasks]
Name: "desktopicon"; Description: "{cm:TaskDesktop}"; GroupDescription: "{cm:TaskGroup}"
Name: "firewall"; Description: "{cm:TaskFirewall}"; GroupDescription: "{cm:TaskGroup}"

[Files]
Source: "..\dist\win-unpacked\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\Eltávolítás"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""MinePixel Multiplayer"" dir=in action=allow protocol=TCP localport=25566"; Flags: runhidden; Tasks: firewall
Filename: "{app}\{#AppExe}"; Description: "{cm:RunGame}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""MinePixel Multiplayer"""; Flags: runhidden

[Code]
const
  COL_BG    = $242424;   // sötét kő (BGR)
  COL_STONE = $757575;
  COL_GREEN = $3A8A4F;
  COL_DARKG = $2A5F33;

var
  BtnBack, BtnNext, BtnCancel: TPanel;

procedure SkinControls(P: TWinControl);
var
  i: Integer;
  C: TControl;
begin
  for i := 0 to P.ControlCount - 1 do
  begin
    C := P.Controls[i];
    if C is TNewStaticText then
      TNewStaticText(C).Font.Color := clWhite
    else if C is TPanel then
      TPanel(C).Color := COL_BG
    else if C is TNewEdit then
    begin
      TNewEdit(C).Color := clBlack;
      TNewEdit(C).Font.Color := clWhite;
    end
    else if C is TNewCheckListBox then
    begin
      TNewCheckListBox(C).Color := COL_BG;
      TNewCheckListBox(C).Font.Color := clWhite;
    end;
    if C is TWinControl then
      SkinControls(TWinControl(C));
  end;
end;

function MakeBtn(R: TNewButton; Handler: TNotifyEvent; Green: Boolean): TPanel;
var
  Inner: TPanel;
begin
  Result := TPanel.Create(WizardForm);
  Result.Parent := WizardForm;
  Result.SetBounds(R.Left, R.Top, R.Width, R.Height);
  Result.BevelOuter := bvNone;
  Result.ParentBackground := False;
  Result.Color := clBlack;
  Result.Cursor := crHand;
  Result.OnClick := Handler;
  Inner := TPanel.Create(Result);
  Inner.Parent := Result;
  Inner.SetBounds(2, 2, R.Width - 4, R.Height - 4);
  Inner.BevelOuter := bvNone;
  Inner.ParentBackground := False;
  if Green then Inner.Color := COL_GREEN else Inner.Color := COL_STONE;
  Inner.Font.Name := 'Courier New';
  Inner.Font.Style := [fsBold];
  Inner.Font.Size := 10;
  Inner.Font.Color := clWhite;
  Inner.Cursor := crHand;
  Inner.OnClick := Handler;
  Result.BringToFront;
end;

procedure SyncButtons;
begin
  BtnBack.Visible := WizardForm.BackButton.Visible;
  TPanel(BtnBack.Controls[0]).Caption := WizardForm.BackButton.Caption;
  BtnNext.Visible := WizardForm.NextButton.Visible;
  TPanel(BtnNext.Controls[0]).Caption := WizardForm.NextButton.Caption;
  BtnCancel.Visible := WizardForm.CancelButton.Visible;
  TPanel(BtnCancel.Controls[0]).Caption := WizardForm.CancelButton.Caption;
  BtnBack.BringToFront; BtnNext.BringToFront; BtnCancel.BringToFront;
end;

procedure BackClick(Sender: TObject);
begin
  WizardForm.BackButton.OnClick(WizardForm.BackButton);
  SyncButtons;
end;

procedure NextClick(Sender: TObject);
begin
  WizardForm.NextButton.OnClick(WizardForm.NextButton);
  SyncButtons;
end;

procedure CancelClick(Sender: TObject);
begin
  WizardForm.CancelButton.OnClick(WizardForm.CancelButton);
end;

procedure InitializeWizard;
begin
  WizardForm.Color := COL_BG;
  WizardForm.InnerPage.Color := COL_BG;
  WizardForm.MainPanel.Color := $1A1A1A;
  WizardForm.Bevel.Visible := False;
  WizardForm.Bevel1.Visible := False;
  SkinControls(WizardForm);
  WizardForm.PageNameLabel.Font.Name := 'Courier New';
  WizardForm.PageNameLabel.Font.Style := [fsBold];
  WizardForm.PageNameLabel.Font.Color := $60E060;
  WizardForm.WelcomeLabel1.Font.Name := 'Courier New';
  WizardForm.WelcomeLabel1.Font.Style := [fsBold];
  WizardForm.WelcomeLabel1.Font.Color := $60E060;
  WizardForm.FinishedHeadingLabel.Font.Name := 'Courier New';
  WizardForm.FinishedHeadingLabel.Font.Style := [fsBold];
  WizardForm.FinishedHeadingLabel.Font.Color := $60E060;
  BtnBack := MakeBtn(WizardForm.BackButton, @BackClick, False);
  BtnNext := MakeBtn(WizardForm.NextButton, @NextClick, True);
  BtnCancel := MakeBtn(WizardForm.CancelButton, @CancelClick, False);
  SyncButtons;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  SyncButtons;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    if MsgBox(CustomMessage('DeleteSaves'), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      DelTree(ExpandConstant('{userappdata}\minepixel'), True, True, True);
end;
