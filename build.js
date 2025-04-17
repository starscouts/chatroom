#!/usr/bin/env node
const fs = require('fs');
const zlib = require('zlib');
const child_process = require("child_process");
const crypto = require("crypto");

if (process.argv[2] === "version") {
    process['versionMode'] = true;
    require('./client/main');
    return;
}

console.log("Note: use './build.js launcher' to build the launchers.");

let ignore = [
    "bans.json",
    "verify.json",
    "motd.md",
    "remote.lctsc",
    "local.lctsc",
    "debug",
    "build",
    "server.txt",
    ".DS_Store",
    "Electron.app"
];

function scandir(path) {
    let list = [];
    list.push(path);

    for (let file of fs.readdirSync(path)) {
        if (fs.lstatSync(path + "/" + file).isDirectory()) {
            if (!ignore.includes(file)) {
                list.push(path + "/" + file);
                list.push(...scandir(path + "/" + file));
            }
        } else {
            if (!ignore.includes(file)) list.push(path + "/" + file);
        }
    }

    return list;
}

let list = scandir("./client");
let pack = [];

function processFile(item) {
    if (item.endsWith("main.js")) {
        let data = fs.readFileSync(item).toString();
        data = data.replace(/\/\/ --- >START< @BUILDNUMBER@ >START< --- \/\/\n((.|\n)*)\n\/\/ --- >FINAL< @BUILDNUMBER@ >FINAL< --- \/\/\n\n/gm, "// --- >START< @BUILDNUMBER@ >START< --- //\nconst buildNumber = \"" + new Date().toISOString().split("T")[0] + "\";\n// --- >FINAL< @BUILDNUMBER@ >FINAL< --- //\n\n");
        return Buffer.from(data);
    } else {
        return fs.readFileSync(item);
    }
}

for (let item of list) {
    if (fs.lstatSync(item).isDirectory()) {
        pack.push({
            type: "directory",
            name: item,
            content: null
        });
    } else {
        pack.push({
            type: "file",
            name: item,
            content: zlib.brotliCompressSync(processFile(item)).toString("base64"),
            hash: crypto.createHash("sha256").update(processFile(item)).digest("base64")
        });
    }
}

fs.writeFileSync("build/client.lctpk", zlib.brotliCompressSync(JSON.stringify(pack)));

child_process.execSync("scp build/client.lctpk watson:/opt/localchat/update/client.lctpk", { stdio: "inherit" });
child_process.execSync(`curl -v --header "PRIVATE-TOKEN: $(cat ~/.deploy.txt)" --header "Content-Type: multipart/form-data" --upload-file ./build/client.lctpk https://source.equestria.dev/api/v4/projects/74/packages/generic/chatroom-client/"$(node build.js version)"-${Math.round(new Date().getTime() / 1000).toString(16)}/chatroom-client.lctpk`, { stdio: "inherit" });

if (process.argv[2] === "launcher") {
    let id = Math.round(new Date().getTime() / 1000).toString(16);

    child_process.execSync("npx electron-packager . Chatroom --ignore build --ignore scripts --overwrite --icon icon.icns --platform=darwin --arch=arm64 --out=../../build/client", { cwd: "./launcher/client", stdio: "inherit" });
    child_process.execSync(`zip -r ../../../build/client/Chatroom-Mac-ARM64.zip -- Chatroom.app`, { stdio: "inherit", cwd: "./build/client/Chatroom-darwin-arm64" });
    child_process.execSync("npx electron-packager . Chatroom --ignore build --ignore scripts --overwrite --icon icon.ico --platform=win32 --arch=x64 --out=../../build/client", { cwd: "./launcher/client", stdio: "inherit" });
    child_process.execSync(`zip -r ../../../build/client/Chatroom-Win32-x64.zip -- *`, { stdio: "inherit", cwd: "./build/client/Chatroom-win32-x64" });
    child_process.execSync("npx electron-packager . Chatroom --ignore build --ignore scripts --overwrite --icon icon.png --platform=linux --arch=x64 --out=../../build/client", { cwd: "./launcher/client", stdio: "inherit" });
    child_process.execSync(`zip -r ../../../build/client/Chatroom-Linux-x64.zip -- *`, { stdio: "inherit", cwd: "./build/client/Chatroom-linux-x64" });
    child_process.execSync(`curl -v --header "PRIVATE-TOKEN: $(cat ~/.deploy.txt)" --header "Content-Type: multipart/form-data" --upload-file ./build/client/Chatroom-Mac-ARM64.zip https://source.equestria.dev/api/v4/projects/74/packages/generic/chatroom-loader/${id}/Chatroom-Mac-ARM64.zip`, { stdio: "inherit" });
    child_process.execSync(`curl -v --header "PRIVATE-TOKEN: $(cat ~/.deploy.txt)" --header "Content-Type: multipart/form-data" --upload-file ./build/client/Chatroom-Win32-x64.zip https://source.equestria.dev/api/v4/projects/74/packages/generic/chatroom-loader/${id}/Chatroom-Win32-x64.zip`, { stdio: "inherit" });
    child_process.execSync(`curl -v --header "PRIVATE-TOKEN: $(cat ~/.deploy.txt)" --header "Content-Type: multipart/form-data" --upload-file ./build/client/Chatroom-Linux-x64.zip https://source.equestria.dev/api/v4/projects/74/packages/generic/chatroom-loader/${id}/Chatroom-Linux-x64.zip`, { stdio: "inherit" });
    child_process.execSync('rm -rf ./build/client/*.zip');
}
