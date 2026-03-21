"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setData = exports.getData = exports.uuidv4 = exports.generateId = exports._getDateTimeOffset = exports.ExecutionError = void 0;
/**
 *
 */
class ExecutionError extends Error {
    constructor(message, statusCode, messageData, isSAPMessage, headers = {}, isGlobalRequestError = false) {
        super(message);
        this.isCustomError = true;
        this.statusCode = statusCode;
        this.messageData = messageData;
        this.isSAPMessage = isSAPMessage;
        this.headers = headers;
        this.isGlobalRequestError = isGlobalRequestError;
    }
}
exports.ExecutionError = ExecutionError;
function _getDateTimeOffset(isV4) {
    const date = new Date();
    return isV4 ? date.toISOString() : '/Date(' + date.getTime() + '/';
}
exports._getDateTimeOffset = _getDateTimeOffset;
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/**
 * Generate an ID of a given length.
 *
 * @param length
 * @returns the generated ID
 */
function generateId(length) {
    let result = '';
    while (length--) {
        result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return result;
}
exports.generateId = generateId;
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0, v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
exports.uuidv4 = uuidv4;
function getData(fullData, objectPath) {
    if (fullData === undefined || objectPath.length === 0) {
        return fullData;
    }
    if (objectPath.indexOf('/') === -1) {
        return fullData === null || fullData === void 0 ? void 0 : fullData[objectPath]; // fullData can be null
    }
    else {
        const subObjectPath = objectPath.split('/');
        return getData(fullData[subObjectPath[0]], subObjectPath.slice(1).join('/'));
    }
}
exports.getData = getData;
function setData(currentNode, deepProperty, value) {
    var _a;
    const deepPropertyPath = deepProperty.split('/');
    for (const deepPropertyPart of deepPropertyPath.slice(0, deepPropertyPath.length - 1)) {
        (_a = currentNode[deepPropertyPart]) !== null && _a !== void 0 ? _a : (currentNode[deepPropertyPart] = {});
        currentNode = currentNode[deepPropertyPart];
    }
    currentNode[deepPropertyPath[deepPropertyPath.length - 1]] = value;
}
exports.setData = setData;
//# sourceMappingURL=common.js.map