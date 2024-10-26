import packageJson from '$root/package.json';
import neuConfig from '$root/neutralino.config.json';
import BuildConfig from '$root/build.config';
import fs from 'fs';
import path from 'path';
import { Signale } from 'signale';
import { NtExecutable, NtExecutableResource, Data, Resource } from 'resedit';
import * as makensis from 'makensis';

export async function winBuild() {
    const logger = new Signale();
    if (!BuildConfig.win) {
        logger.fatal('No windows config was found in build.config.js!');
        return;
    }

    const Dist = path.resolve('.tmpbuild');

    for (const app of BuildConfig.win.architecture) {
        const appTime = performance.now();
        const appDist = path.resolve(Dist, 'win_' + app);

        fs.mkdirSync(appDist, { recursive: true });
        fs.mkdirSync(path.resolve(Dist, 'installer'), { recursive: true });

        const l = new Signale({ scope: 'build-win-' + app, interactive: true });
        l.await(`Building win-${app}`);

        const neuResources = path.resolve('dist', neuConfig.cli.binaryName, 'resources.neu');
        if (!fs.existsSync(neuResources)) {
            l.fatal("No 'resources.neu' file was not found in the ./dist directory");
            return;
        }

        const executable = path.resolve('dist', neuConfig.cli.binaryName, `${neuConfig.cli.binaryName}-win_${app}.exe`);
        if (!fs.existsSync(executable)) {
            l.fatal(`The '${neuConfig.cli.binaryName}-win_${app}.exe' executable was not found in the ./dist directory`);
            return;
        }

        const data = fs.readFileSync(executable);
        const exe = NtExecutable.from(data);
        const res = NtExecutableResource.from(exe);

        const iconData = fs.readFileSync(BuildConfig.win.appIcon);
        const iconFile = Data.IconFile.from(iconData);
        Resource.IconGroupEntry.replaceIconsForResource(
            res.entries,
            101,
            1033,
            iconFile.icons.map((item) => item.data)
        );

        const vi = Resource.VersionInfo.createEmpty();
        vi.setFileVersion(0, 0, Number(neuConfig.version), 0, 1033);
        vi.setStringValues(
            { lang: 1033, codepage: 1200 },
            {
                FileDescription: BuildConfig.description,
                ProductName: BuildConfig.appName,
                ProductVersion: neuConfig.version,
                CompanyName: packageJson.author,
            }
        );
        vi.outputToResourceEntries(res.entries);

        if (BuildConfig.win.embedResources) {
			// @ts-expect-error
            res.entries.push({
                type: 10,
                id: 1000,
                lang: 1033,
                bin: fs.readFileSync(neuResources)
            });
        }

        fs.copyFileSync(neuResources, path.join(appDist, 'resources.neu'));

        res.outputResource(exe);
        const outputExe = path.resolve(appDist, `${BuildConfig.appName}.exe`);
        fs.writeFileSync(outputExe, new Uint8Array(exe.generate()));

        const installerDir = path.resolve(Dist, 'win_installer');
        const nsisScript = `!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "${BuildConfig.appName}"
OutFile "${path.resolve(installerDir, `${BuildConfig.appName}-Setup-${neuConfig.version}-${app}.exe`)}"
InstallDir "$PROGRAMFILES${app === 'x64' ? '64' : ''}\\${BuildConfig.appName}"
RequestExecutionLevel admin

!define MUI_ICON "${BuildConfig.win.appIcon}"
!define MUI_UNICON "${BuildConfig.win.appIcon}"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite ifnewer
    
    File "${outputExe}"
    File "${path.join(appDist, 'resources.neu')}"
    
    CreateDirectory "$SMPROGRAMS\\${BuildConfig.appName}"
    CreateShortCut "$SMPROGRAMS\\${BuildConfig.appName}\\${BuildConfig.appName}.lnk" "$INSTDIR\\${BuildConfig.appName}.exe"
    CreateShortCut "$DESKTOP\\${BuildConfig.appName}.lnk" "$INSTDIR\\${BuildConfig.appName}.exe"
    
    WriteUninstaller "$INSTDIR\\uninstall.exe"
    
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${BuildConfig.appName}" "DisplayName" "${BuildConfig.appName}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${BuildConfig.appName}" "UninstallString" "$INSTDIR\\uninstall.exe"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${BuildConfig.appName}" "DisplayIcon" "$INSTDIR\\${BuildConfig.appName}.exe"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${BuildConfig.appName}" "Publisher" "${packageJson.author}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${BuildConfig.appName}" "DisplayVersion" "${neuConfig.version}"
SectionEnd

Section "Uninstall"
    Delete "$INSTDIR\\${BuildConfig.appName}.exe"
    Delete "$INSTDIR\\resources.neu"
    Delete "$INSTDIR\\uninstall.exe"
    
    Delete "$SMPROGRAMS\\${BuildConfig.appName}\\${BuildConfig.appName}.lnk"
    Delete "$DESKTOP\\${BuildConfig.appName}.lnk"
    
    RMDir "$SMPROGRAMS\\${BuildConfig.appName}"
    RMDir "$INSTDIR"
    
    DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${BuildConfig.appName}"
SectionEnd`;

        // Write NSIS script to file
        const scriptPath = path.join(appDist, 'installer.nsi');
        fs.writeFileSync(scriptPath, nsisScript);

        try {
            l.await('Creating installer...');
            
            const result = await makensis.compile(scriptPath, {
                verbose: 2,
                noCD: true
            }, {});

            if (result.status === 0) {
                l.complete(`win_${app} installer built in ${((performance.now() - appTime) / 1000).toFixed(3)}s ${BuildConfig.win.embedResources ? '(Embedded Resources)' : ''}`);
            } else {
                throw new Error(`NSIS Error: ${result.stderr}`);
            }
        } catch (error) {
            l.error('Failed to create installer:', error);
            throw error;
        }
    }
}