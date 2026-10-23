"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIsoDate = toIsoDate;
exports.toIsoDateTime = toIsoDateTime;
exports.dateOnlyToMillis = dateOnlyToMillis;
exports.round2 = round2;
exports.usdDesdeBs = usdDesdeBs;
exports.ordenarPorFechaAscendente = ordenarPorFechaAscendente;
exports.money = money;
const pad = (n) => String(n).padStart(2, '0');
function toIsoDate(date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
function toIsoDateTime(date) {
    const base = `${toIsoDate(date)}T${pad(date.getUTCHours())}:` +
        `${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    const ms = date.getUTCMilliseconds();
    return ms === 0 ? base : `${base}.${String(ms).padStart(3, '0')}`;
}
function dateOnlyToMillis(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
}
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function usdDesdeBs(montoBs, tasa) {
    const t = Number(tasa) || 0;
    return t ? round2((Number(montoBs) || 0) / t) : 0;
}
function ordenarPorFechaAscendente(registros) {
    return [...registros].sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime() || a.id - b.id);
}
function money(value) {
    return (Number(value) || 0).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
//# sourceMappingURL=dates.js.map