const WebSocketServer = require('ws').WebSocketServer;
const crypto = require('crypto');
const fs = require("fs");

const wss = new WebSocketServer({ port: 19218 });

wss.on('connection', function connection(ws) {
    ws.authenticated = false;
    ws.token = null;
    ws.auth = null;

    ws._send = ws.send;
    ws.send = (d) => {
        return ws._send(JSON.stringify(d));
    }

    ws.on('error', console.error);

    ws.on('message', async (_data) => {
        try {
            let data = JSON.parse(_data);

            if (data.state) {
                switch (data.state) {
                    case "AUTHENTICATION_RESPONSE":
                        if (data.token) {
                            let userInfo = (await (await fetch("https://school.equestria.dev/_matrix/client/v3/account/whoami", { headers: { 'Authorization': 'Bearer ' + data.token } })).json());
                            console.log(userInfo);

                            if (userInfo['user_id']) {
                                ws.auth = userInfo;
                                ws.token = data.token;
                                ws.authenticated = true;

                                ws.send({
                                    state: "AUTHENTICATION_OK"
                                });
                            } else {
                                ws.close();
                            }
                        }
                        break;
                }

                if (!ws.authenticated) ws.close();

                switch (data.state) {
                    case "SYSTEM_REPORT":
                        let id = crypto.createHash("sha1").update(data.id).digest("hex");
                        let report = data.data;
                        report['timestamp'] = new Date().toUTCString();

                        if (!fs.existsSync("./data")) fs.mkdirSync("./data");
                        fs.writeFileSync("./data/" + id + ".json", JSON.stringify(report));
                }
            }
        } catch (e) {
            console.error(e);
        }
    });

    ws.send({
        state: "NEEDS_AUTHENTICATION"
    });
});
