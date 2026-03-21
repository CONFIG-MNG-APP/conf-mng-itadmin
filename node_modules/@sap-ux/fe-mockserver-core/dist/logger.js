"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = void 0;
const process_1 = __importDefault(require("process"));
class Logger {
    constructor(loggerName, debug) {
        this.loggerName = loggerName;
        this.debug = debug;
    }
    error(message) {
        process_1.default.stderr.write('error ' + this.loggerName + ' :: ' + message.toString() + '\n');
    }
    info(message) {
        if (this.debug) {
            process_1.default.stdout.write('info ' + this.loggerName + ' :: ' + message + '\n');
        }
    }
}
function getLogger(loggerName, debug) {
    return new Logger(loggerName, debug);
}
exports.getLogger = getLogger;
//# sourceMappingURL=logger.js.map