"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MetadataProvider {
    constructor(fileLoader) {
        this.fileLoader = fileLoader;
    }
    async loadMetadata(filePath) {
        return this.fileLoader.loadFile(filePath);
    }
    addI18nPath(_i18Path) {
        // do nothing
    }
}
exports.default = MetadataProvider;
//# sourceMappingURL=metadataProvider.js.map