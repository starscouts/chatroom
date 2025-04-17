// --- >START< @BUILDNUMBER@ >START< --- //
const buildNumber = "main";
// --- >FINAL< @BUILDNUMBER@ >FINAL< --- //

let version = "2.9.7";

if (process['versionMode']) {
    console.log(version);
    return;
}

const { desktopCapturer, protocol, app, BrowserWindow, webContents, globalShortcut, nativeTheme, ipcMain, session, dialog, Menu } = require('electron');
const os = require("os");
const {writeFileSync} = require("fs");
const fs = require("fs");

if (!app.requestSingleInstanceLock()) {
    dialog.showMessageBoxSync({
        type: "warning",
        message: "Chatroom is already running",
        detail: "Another instance of Chatroom is already running and might not be responding. Please wait or use your system's activity monitor or task manager to terminate the other instance.",
        noLink: true,
        buttons: ["Quit"]
    });

    try { loaderWindow.destroy(); } catch (e) {}
    app.quit();
}

try {
    if (!app.getAppPath().endsWith("/launcher/client")) writeFileSync(app.getAppPath() + "/index.html", fs.readFileSync("./fragments/launcher.html"));
    if (!app.getAppPath().endsWith("/launcher/client")) writeFileSync(app.getAppPath() + "/loader.jpg", fs.readFileSync("./assets/loader.jpg"));
} catch (e) {
    console.error(e);
}

const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const { fetch } = require('cross-fetch');

app.on('web-contents-created', (e, contents) => {
    console.log(contents, contents.getType());

    if (contents.getType() === 'webview') {
        contents.setWindowOpenHandler((details) => {
            console.log(details);
            if (mainWindow) mainWindow.webContents.executeJavaScript(`openTab(atob("${Buffer.from(details.url).toString("base64")}"));`);
            mainWindow.webContents.focus();
        });
    }
})

ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
    global.blocker = blocker;
});

ipcMain.handle('get-screenshots', async () => {
    let sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
            width: 1280,
            height: 720
        }
    });
    return sources.map(i => i.thumbnail.toJPEG(85).toString("base64"));
});

ipcMain.handle('version', async () => {
    return version;
});

ipcMain.on('enable-protection', () => {
    let waiter = setInterval(() => {
        if (global.blocker) {
            clearInterval(waiter);
            try { global.blocker.enableBlockingInSession(session.defaultSession); } catch (e) {
                console.error(e);
            }
        }
    });
});

ipcMain.on('disable-protection', () => {
    let waiter = setInterval(() => {
        if (global.blocker) {
            clearInterval(waiter);
            try { global.blocker.disableBlockingInSession(session.defaultSession); } catch (e) {
                console.error(e);
            }
        }
    });
});

global.baseUserAgent = session.defaultSession.getUserAgent();

let localchatDataRoot = (os.platform() === "win32" ? os.homedir() + "/AppData/Roaming" : (os.platform() === "darwin" ? os.homedir() + "/Library/Application Support" : os.homedir())) + (os.platform() === "darwin" ? "/ChatroomWorkspace" : "/.chatroom-workspace");
console.log(localchatDataRoot);

if (!fs.existsSync(localchatDataRoot)) fs.mkdirSync(localchatDataRoot);
if (!fs.existsSync(localchatDataRoot + "/session")) fs.mkdirSync(localchatDataRoot + "/session");
if (!fs.existsSync(localchatDataRoot + "/data")) fs.mkdirSync(localchatDataRoot + "/data");
if (!fs.existsSync(localchatDataRoot + "/logs")) fs.mkdirSync(localchatDataRoot + "/logs");

app.setPath("userData", localchatDataRoot + "/data");
app.setPath("sessionData", localchatDataRoot + "/session");
app.setAppLogsPath(localchatDataRoot + "/logs");

if (require('os').platform() !== "darwin" && require('os').platform() !== "win32" && require('os').platform() !== "linux") return;
global.windows = [];
if (!global._localchatPath) global._localchatPath = __dirname;

require('@electron/remote/main').initialize();

const createWindow = () => {
    app.setPath("userData", localchatDataRoot);
    app.setPath("sessionData", localchatDataRoot + "/session");
    app.setAppLogsPath(localchatDataRoot + "/logs");

    global.mainWindow = new BrowserWindow({
        width: 1280,
        minWidth: 900,
        height: 720,
        minHeight: 300,
        titleBarStyle: "hidden",
        titleBarOverlay: nativeTheme.shouldUseDarkColors ? {
            color: "#111111",
            symbolColor: "#eeeeee",
            height: 43
        } : {
            color: "#eeeeee",
            symbolColor: "#222222",
            height: 42
        },
        backgroundColor:  nativeTheme.shouldUseDarkColors ? "#111111" : "#eeeeee",
        trafficLightPosition: {
            x: 15,
            y: 15
        },
        icon: require('os').platform() === "darwin" ? "./assets/icon.icns" : (require('os').platform() === "linux" ? "./assets/icon.png" : "./assets/icon.ico"),
        show: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInSubFrames: true,
            contextIsolation: false,
            additionalArguments: "--user-data-dir=\"" + localchatDataRoot + "/client" + "\"",
            webviewTag: true,
            plugins: true,
            scrollBounce: true,
            autoplayPolicy: "document-user-activation-required",
            enableWebSQL: false
        }
    });

    require("@electron/remote/main").enable(mainWindow.webContents);

    let shouldExit = false;

    mainWindow.on('close', async (event) => {
        if (shouldExit || fs.existsSync(app.getPath("userData") + "/disable-confirmation")) return;
        event.preventDefault();

        let status = await dialog.showMessageBox(global.mainWindow ?? null, {
            type: "warning",
            message: "Quit Chatroom?",
            checkboxLabel: "Don't ask me again",
            checkboxChecked: false,
            detail: "Are you sure you want to quit Chatroom? Unsaved data will be lost.",
            noLink: true,
            buttons: ["Yes", "No"]
        });

        if (status.response === 0) {
            if (status.checkboxChecked) {
                fs.writeFileSync(app.getPath("userData") + "/disable-confirmation", "");
            }

            shouldExit = true;
            mainWindow.close();
        }
    });

    mainWindow.loadFile(global._localchatPath + "/dom/index.html");

    require("@electron/remote/main").enable(mainWindow.webContents);

    let menu = Menu.buildFromTemplate([
        ...(process.platform === "darwin" ? [
            {
                role: "appMenu",
                type: "submenu",
                label: "Chatroom",
                submenu: [
                    {
                        label: "About Chatroom",
                        click: (_, win) => {
                            try { win.webContents.executeJavaScript('window.focusAbout();') } catch (e) { console.error(e); }
                        }
                    },
                    {
                        type: "separator"
                    },
                    {
                        role: "services"
                    },
                    {
                        type: "separator"
                    },
                    {
                        role: "hide"
                    },
                    {
                        role: "hideOthers"
                    },
                    {
                        role: "unhide"
                    },
                    {
                        type: "separator"
                    },
                    {
                        role: "quit"
                    },
                ]
            }
        ] : []),
        {
            type: "submenu",
            label: "File",
            submenu: [
                {
                    label: "New Tab",
                    click: (_, win) => {
                        try { win.webContents.executeJavaScript('window.openHome();'); } catch (e) { console.error(e); }
                    },
                    accelerator: "CmdOrCtrl+T"
                },
                {
                    label: "Switch to Next Tab",
                    click: (_, win) => {
                        try { win.webContents.executeJavaScript('window.switchRight();'); } catch (e) { console.error(e); }
                    },
                    accelerator: "Ctrl+Tab"
                },
                {
                    label: "Switch to Previous Tab",
                    click: (_, win) => {
                        try { win.webContents.executeJavaScript('window.switchLeft();'); } catch (e) { console.error(e); }
                    },
                    accelerator: "Ctrl+Shift+Tab"
                },
                {
                    label: "Close Tab",
                    click: (_, win) => {
                        try { win.webContents.executeJavaScript('window.closeCurrentTab();'); } catch (e) { console.error(e); }
                    },
                    accelerator: "CmdOrCtrl+W"
                }
            ]
        },
        {
            role: "editMenu"
        },
        {
            type: "submenu",
            label: "View",
            submenu: [
                {
                    label: "Host",
                    submenu: [
                        {
                            role: "reload",
                            label: "Reload",
                            accelerator: "CmdOrCtrl+Alt+R"
                        },
                        {
                            role: "forceReload",
                            label: "Force Reload",
                            accelerator: "CmdOrCtrl+Shift+Alt+R"
                        },
                        {
                            role: "toggleDevTools",
                            label: "Toggle Developer Tools",
                            accelerator: "CmdOrCtrl+Alt+Shift+I"
                        }
                    ]
                },
                {
                    label: "Renderer",
                    submenu: [
                        {
                            label: "Reload",
                            accelerator: "CmdOrCtrl+R",
                            click: () => {
                                mainWindow.webContents.executeJavaScript('window.reloadWebview(false);');
                            }
                        },
                        {
                            label: "Force Reload",
                            accelerator: "CmdOrCtrl+Shift+R",
                            click: () => {
                                mainWindow.webContents.executeJavaScript('window.reloadWebview(true);');
                            }
                        },
                        {
                            label: "Toggle Developer Tools",
                            accelerator: "CmdOrCtrl+Alt+I",
                            click: () => {
                                mainWindow.webContents.executeJavaScript('window.openDevTools();');
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    role: "resetZoom"
                },
                {
                    role: "zoomIn"
                },
                {
                    role: "zoomOut"
                },
                {
                    type: "separator"
                },
                {
                    role: "togglefullscreen"
                }
            ]
        },
        {
            role: "windowMenu"
        }
    ]);

    mainWindow.setMenu(menu);
    Menu.setApplicationMenu(menu);

    mainWindow.webContents.setWindowOpenHandler(() => {
        return {
            action: "deny"
        }
    });

    windows.push(mainWindow);
    if (os.platform() === "win32") mainWindow.setContentProtection(true);

    ipcMain.on('setupIcon', (e, id, index) => {
        webContents.fromId(id).on('page-favicon-updated', (e, icons) => {
            mainWindow.send("favicon", {
                index,
                icons
            });
        })
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        try { loaderWindow.close(); } catch (e) {}
    });
}

app.whenReady().then(() => {
    globalShortcut.register('Alt+CommandOrControl+C', () => {
        for (let window of windows) {
            try {
                if (!window.isVisible()) {
                    window.show();
                    if (process.platform === "darwin") app.dock.show();
                } else {
                    window.hide();
                    if (process.platform === "darwin") app.dock.hide();
                }
            } catch (e) {}
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    app.quit();
});

ipcMain.handle('3pid', (_, origin) => {
    return new Promise(async (res) => {
        if (!global.mainWindow) res(null);

        ipcMain.once('3pid-token', async (_, _token) => {
            let token = _token;

            if (token) {
                if (dialog.showMessageBoxSync(global.mainWindow, {
                    type: "warning",
                    message: (origin.trim() !== "" ? origin : "This page") + " is requesting access to your Chatroom account, do you want to allow it?",
                    buttons: ["Allow", "Deny"],
                    defaultId: 0,
                    cancelId: 1,
                    detail: "If you continue, this will allow " + (origin.trim() !== "" ? origin : "this page") + " and any potential third-party code running on it to access your entire Chatroom account on your behalf, including the ability to send and receive messages to and from unencrypted rooms.\n\nThis is very dangerous and should only be done with websites you trust, and only if there is a good reason to do so (for example, to sign you in using Chatroom).\n\nIf you allow a malicious application, please contact your administrator immediately and log out from your Chatroom account on all devices."
                }) === 0) {
                    res(token);
                } else {
                    res(null);
                }
            }
        });

        await global.mainWindow.webContents.executeJavaScript("getToken()");
    });
});

ipcMain.handle('3pid-possible', (_) => {
    return new Promise(async (res) => {
        if (!global.mainWindow) return;

        ipcMain.once('3pid-token', async (_, _token) => {
            if (_token) {
                res(true);
            } else {
                res(false);
            }
        });

        await global.mainWindow.webContents.executeJavaScript("getToken()");
    });
});

ipcMain.handle('address-bar', (_) => {
    return new Promise(async (res) => {
        if (!global.mainWindow) return;
        await global.mainWindow.webContents.executeJavaScript("focusAddressBar()");
    });
});

ipcMain.handle('deprecated', (_) => {
    return new Promise(async (res) => {
        if (!global.mainWindow) return;
        res(await global.mainWindow.webContents.executeJavaScript("localStorage.getItem('cr3-trial-removelegacyapis') === 'true'"));
    });
});

ipcMain.handle('reload', (_) => {
    return new Promise(async (res) => {
        if (!global.mainWindow) return;
        res(await global.mainWindow.webContents.reload());
    });
});

ipcMain.on('menu', (_, params) => {
    console.log(params);

    let items = [];

    if (params.linkURL.trim() !== "") {
        items.push({
            label: "Open Link in New Tab",
            click: (item, win) => {
                win.webContents.executeJavaScript(`openTab("${params.linkURL.replaceAll('"', '\\"')}");`);
            }
        });
    }

    if (params.frameURL.trim() !== "") {
        items.push({
            label: "Open Frame in New Tab",
            click: (item, win) => {
                win.webContents.executeJavaScript(`openTab("${params.frameURL.replaceAll('"', '\\"')}");`);
            }
        });
    }

    if (params.srcURL.trim() !== "") {
        let type = "Media";

        switch (params.mediaType) {
            case "audio":
                type = "Audio";
                break;

            case "image":
                type = "Image";
                break;

            case "video":
                type = "Video";
                break;

            case "canvas":
                type = "Canvas";
                break;

            case "file":
                type = "File";
                break;
        }

        items.push({
            label: "Open " + type + " in New Tab",
            click: (item, win) => {
                win.webContents.executeJavaScript(`openTab("${params.srcURL.replaceAll('"', '\\"')}");`);
            }
        });
    }

    if (process.platform === "darwin" && (params.selectionRect.width > 2 && params.selectionRect.height > 2)) {
        items.push({
            label: params.selectionText.trim() === "" ? "Look Up" : "Look Up “" + (params.selectionText.length < 100 ? params.selectionText : params.selectionText.substring(0, 100) + "…") + "”",
            click: (item, win) => {
                win.webContents.executeJavaScript(`tabs[activeTab].webview.children[1].showDefinitionForSelection();`);
            }
        });
    }

    if (items.length > 0) {
        items.push({
            type: "separator"
        });
    }

    items.push({
        enabled: params.editFlags.canCut,
        label: "Cut",
        click: (item, win) => {
            win.webContents.executeJavaScript(`tabs[activeTab].webview.children[1].cut();`);
        }
    });

    items.push({
        enabled: params.selectionText.trim() !== "" || params.editFlags.canCopy,
        label: "Copy",
        click: (item, win) => {
            win.webContents.executeJavaScript(`tabs[activeTab].webview.children[1].cut();`);
        }
    });

    items.push({
        enabled: params.editFlags.canPaste,
        label: "Paste",
        click: (item, win) => {
            win.webContents.executeJavaScript(`tabs[activeTab].webview.children[1].paste();`);
        }
    });

    if (process.platform === "darwin" || process.platform === "win32") {
        items.push({
            enabled: params.editFlags.canEditRichly || params.editFlags.canPaste || params.editFlags.canDelete || params.editFlags.canUndo || params.editFlags.canRedo,
            label: "Open Emoji Picker",
            click: () => {
                app.showEmojiPanel();
            }
        });
    }

    items.push({
        type: "separator"
    });

    items.push({
        enabled: params.editFlags.canSelectAll,
        label: "Select All",
        click: (item, win) => {
            win.webContents.executeJavaScript(`tabs[activeTab].webview.children[1].selectAll();`);
        }
    });

    items.push({
        enabled: params.editFlags.canUndo,
        label: "Undo",
        click: (item, win) => {
            win.webContents.executeJavaScript(`tabs[activeTab].webview.children[1].undo();`);
        }
    });

    items.push({
        enabled: params.editFlags.canRedo,
        label: "Redo",
        click: (item, win) => {
            win.webContents.executeJavaScript(`tabs[activeTab].webview.children[1].redo();`);
        }
    });

    let menu = Menu.buildFromTemplate(items);

    menu.popup({
        window: mainWindow,
        x: params.x,
        y: params.y,
        sourceType: params.menuSourceType
    });
});
