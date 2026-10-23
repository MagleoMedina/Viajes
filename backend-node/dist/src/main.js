"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const fs_1 = require("fs");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("typeorm");
const app_module_1 = require("./app.module");
const migraciones_1 = require("./common/migraciones");
const sistema_1 = require("./common/sistema");
async function bootstrap() {
    if (!process.env.DB_PATH) {
        (0, fs_1.mkdirSync)('data', { recursive: true });
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    await (0, migraciones_1.aplicarMigraciones)(app.get(typeorm_1.DataSource));
    app.enableCors();
    app.enableShutdownHooks();
    const port = Number(process.env.PORT ?? 8080);
    const host = process.env.HOST ?? '0.0.0.0';
    await app.listen(port, host);
    const urls = [
        `http://localhost:${port}`,
        ...(0, sistema_1.ipsLocales)().map((ip) => `http://${ip}:${port}`),
    ];
    console.log(`Aplicación ejecutándose en ${urls.join('  |  ')}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map