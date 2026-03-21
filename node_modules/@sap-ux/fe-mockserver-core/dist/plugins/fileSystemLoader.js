"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graceful_fs_1 = require("graceful-fs");
const util_1 = require("util");
const readFileP = (0, util_1.promisify)(graceful_fs_1.readFile);
const accessP = (0, util_1.promisify)(graceful_fs_1.access);
class FileSystemLoader {
    constructor(tsConfigPath) {
        this.tsConfigPath = tsConfigPath;
        this.isTSLoaded = false;
    }
    async loadFile(filePath) {
        return readFileP(filePath, 'utf-8');
    }
    isTypescriptEnabled() {
        let isTSNodeThere;
        try {
            require.resolve('ts-node');
            // Checking CDS_TYPESCRIPT to let CAP do their things
            isTSNodeThere = true;
        }
        catch (e) {
            isTSNodeThere = false;
        }
        if (isTSNodeThere && !this.isTSLoaded && process.env.CDS_TYPESCRIPT !== 'tsx') {
            let options = {};
            if (this.tsConfigPath) {
                options = { project: this.tsConfigPath };
            }
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require('ts-node').register(options);
            this.isTSLoaded = true;
            return true;
        }
        else if (!this.isTSLoaded) {
            this.isTSLoaded = process.env.CDS_TYPESCRIPT === 'tsx';
        }
        return this.isTSLoaded;
    }
    async exists(filePath) {
        try {
            await accessP(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    syncSupported() {
        return true;
    }
    existsSync(filePath) {
        try {
            (0, graceful_fs_1.accessSync)(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    loadFileSync(filePath) {
        return (0, graceful_fs_1.readFileSync)(filePath, 'utf-8');
    }
    async loadJS(filePath) {
        delete require.cache[filePath];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        let requireResult = require(filePath);
        if (requireResult.default) {
            requireResult = requireResult.default;
        }
        return Promise.resolve(requireResult);
    }
}
exports.default = FileSystemLoader;
//# sourceMappingURL=fileSystemLoader.js.map