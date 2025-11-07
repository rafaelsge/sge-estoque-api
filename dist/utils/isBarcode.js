"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBarcode = isBarcode;
function isBarcode(value) {
    return /^[0-9]{8,14}$/.test(value);
}
