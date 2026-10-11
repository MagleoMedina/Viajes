"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const fs_1 = require("fs");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    if (!process.env.DB_PATH) {
        (0, fs_1.mkdirSync)('data', { recursive: true });
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    await app.listen(process.env.PORT ?? 8080);
}
void bootstrap();
//# sourceMappingURL=main.js.map