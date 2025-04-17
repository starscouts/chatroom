const { contextBridge, ipcRenderer } = require('electron');
const crObj = {
    thirdPartyAuth: {
        getToken: async () => {
            return await ipcRenderer.invoke("3pid", location.host);
        },
        isPossible: async () => {
            return await ipcRenderer.invoke("3pid-possible");
        }
    },
    focusAddressBar: async () => {
        return await ipcRenderer.invoke("address-bar");
    },
    getVersion: async () => {
        return await ipcRenderer.invoke("version");
    },
    reloadHost: async () => {
        if (location.protocol !== "file:") throw new Error("reloadHost is only available from local pages.");
        return await ipcRenderer.invoke("reload");
    }
};

try {
    contextBridge.exposeInMainWorld(
        "chatroom",
        crObj
    );

    // TODO: Remove in M3
    contextBridge.exposeInMainWorld(
        "Chatroom3PID",
        {
            getToken: async () => {
                if (await ipcRenderer.invoke("deprecated")) throw new Error("The removelegacyapis experiment is enabled, which removes the Chatroom3PID API. Please update your code to use chatroom.thirdPartyAuth.");
                console.warn("The old Chatroom3PID API is deprecated and will be removed in Chatroom 3.0. Please update your code to use chatroom.thirdPartyAuth instead.");
                return await ipcRenderer.invoke("3pid", location.host);
            },
            isPossible: async () => {
                if (await ipcRenderer.invoke("deprecated")) throw new Error("The removelegacyapis experiment is enabled, which removes the Chatroom3PID API. Please update your code to use chatroom.thirdPartyAuth.");
                console.warn("The old Chatroom3PID API is deprecated and will be removed in Chatroom 3.0. Please update your code to use chatroom.thirdPartyAuth instead.");
                return await ipcRenderer.invoke("3pid-possible");
            }
        }
    );
} catch (e) {
    window.chatroom = crObj;
}
