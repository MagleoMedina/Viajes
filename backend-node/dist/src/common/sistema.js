"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipsLocales = ipsLocales;
exports.infoServidor = infoServidor;
const os_1 = require("os");
function ipsLocales() {
    const ips = [];
    for (const interfaces of Object.values((0, os_1.networkInterfaces)())) {
        for (const dir of interfaces ?? []) {
            if (dir.family !== 'IPv4' || dir.internal)
                continue;
            if (dir.address.startsWith('169.254.'))
                continue;
            ips.push(dir.address);
        }
    }
    return ips;
}
function infoServidor() {
    const ips = ipsLocales();
    return {
        ip: ips[0] ?? '127.0.0.1',
        ips,
        puerto: Number(process.env.PORT ?? 8080),
    };
}
//# sourceMappingURL=sistema.js.map