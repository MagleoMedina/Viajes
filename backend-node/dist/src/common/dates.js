"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIsoDate = toIsoDate;
exports.toIsoDateTime = toIsoDateTime;
exports.dateOnlyToMillis = dateOnlyToMillis;
exports.round2 = round2;
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
function money(value) {
    return (Number(value) || 0).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
//# sourceMappingURL=dates.js.map