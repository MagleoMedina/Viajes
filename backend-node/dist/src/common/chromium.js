"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHROMIUM_VERSION = void 0;
exports.getChromiumExecutablePath = getChromiumExecutablePath;
exports.lanzarChrome = lanzarChrome;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const puppeteer = __importStar(require("puppeteer"));
exports.CHROMIUM_VERSION = '127.0.6533.88';
const EXE_REL = path.join('chrome', `win64-${exports.CHROMIUM_VERSION}`, 'chrome-win64', 'chrome.exe');
function candidatosExecutable() {
    const rutas = [];
    const exeEnv = process.env.CHROMIUM_EXECUTABLE;
    const dirEnv = process.env.CHROMIUM_DIR;
    if (exeEnv)
        rutas.push(exeEnv);
    if (dirEnv)
        rutas.push(path.join(dirEnv, EXE_REL));
    rutas.push(path.join(process.cwd(), '..', 'chromium', EXE_REL));
    rutas.push(path.join(process.cwd(), '..', 'bin', 'chromium', EXE_REL));
    const resourcesPath = process.resourcesPath;
    if (resourcesPath)
        rutas.push(path.join(resourcesPath, 'chromium', EXE_REL));
    return rutas;
}
function getChromiumExecutablePath() {
    return candidatosExecutable().find((ruta) => fs.existsSync(ruta));
}
async function lanzarChrome() {
    const executablePath = getChromiumExecutablePath();
    if (executablePath) {
        console.log(`[chromium] usando el binario embebido: ${executablePath}`);
    }
    else {
        console.warn('[chromium] sin binario embebido; puppeteer usara su cache (~/.cache/puppeteer)');
    }
    return puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
}
//# sourceMappingURL=chromium.js.map