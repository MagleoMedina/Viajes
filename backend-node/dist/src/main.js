"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const fs_1 = require("fs");
const os_1 = require("os");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
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
async function bootstrap() {
    if (!process.env.DB_PATH) {
        (0, fs_1.mkdirSync)('data', { recursive: true });
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    const port = Number(process.env.PORT ?? 8080);
    const host = process.env.HOST ?? '0.0.0.0';
    await app.listen(port, host);
    const urls = [
        `http://localhost:${port}`,
        ...ipsLocales().map((ip) => `http://${ip}:${port}`),
    ];
    console.log(`Aplicación ejecutándose en ${urls.join('  |  ')}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map