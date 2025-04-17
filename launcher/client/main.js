const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require("fs");
const os = require("os");

let localchatDataRoot = (os.platform() === "win32" ? os.homedir() + "/AppData/Roaming" : (os.platform() === "darwin" ? os.homedir() + "/Library/Application Support" : os.homedir())) + (os.platform() === "darwin" || os.platform() === "win32" ? "/ChatroomNG" : "/.chatroom-ng");

if (!fs.existsSync(localchatDataRoot)) fs.mkdirSync(localchatDataRoot);
if (!fs.existsSync(localchatDataRoot + "/session")) fs.mkdirSync(localchatDataRoot + "/session");
if (!fs.existsSync(localchatDataRoot + "/data")) fs.mkdirSync(localchatDataRoot + "/data");
if (!fs.existsSync(localchatDataRoot + "/logs")) fs.mkdirSync(localchatDataRoot + "/logs");

if (fs.existsSync(localchatDataRoot + "/launcher")) {
    process.chdir(localchatDataRoot + "/launcher");
    require(localchatDataRoot + "/launcher/main.js");
}

app.setPath("userData", localchatDataRoot + "/data");
app.setPath("sessionData", localchatDataRoot + "/session");
app.setAppLogsPath(localchatDataRoot + "/logs");

require('@electron/remote/main').initialize();

process.argv = process.argv.filter(i => !i.endsWith("main.js") && i !== ".");

const createWindow = () => {
    global.loaderWindow = new BrowserWindow({
        width: 256,
        height: 300,
        icon: require('os').platform() ? "./icon.icns" : "./icon.ico",
        resizable: false,
        maximizable: false,
        show: false,
        minimizable: false,
        disableAutoHideCursor: true,
        backgroundColor: "#111111",
        darkTheme: true,
        fullscreenable: false,
        frame: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    require("@electron/remote/main").enable(loaderWindow.webContents);
    loaderWindow.loadFile('./index.html');
    loaderWindow.setContentProtection(true);

    ipcMain.on('start', (_, path) => {
        process.chdir(path);
        global._localchatPath = path;
        global._localchatLauncherVersion = app.getVersion();
        require(path + "/main.js");
    });

    loaderWindow.once("ready-to-show", () => {
        loaderWindow.show();

        if (process.argv[1]) {
            loaderWindow.send("local", process.argv[1]);
        } else {
            loaderWindow.send("download");
        }
    });
}

app.whenReady().then(() => {
    createWindow();
});

global.restart = () => {
    app.relaunch();
    app.exit();
}
