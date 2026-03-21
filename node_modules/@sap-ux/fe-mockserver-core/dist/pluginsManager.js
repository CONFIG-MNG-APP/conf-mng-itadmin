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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPluginDefinition = exports.getMetadataProcessor = void 0;
const path = __importStar(require("path"));
/**
 * Get the metadata processor for the given name.
 *
 * @param fileLoader The file loader used to load the metadata processor class
 * @param name The name of the metadata processor class
 * @param options The options for the metadata processor
 * @param i18nPath The path to the i18n files
 * @returns The metadata processor
 */
async function getMetadataProcessor(fileLoader, name, options, i18nPath) {
    const MetadataProcessorClass = await fileLoader.loadJS(name || path.resolve(__dirname, './plugins/metadataProvider'));
    return new MetadataProcessorClass(fileLoader, options, i18nPath);
}
exports.getMetadataProcessor = getMetadataProcessor;
async function getPluginDefinition(fileLoader, name) {
    const PluginClass = await fileLoader.loadJS(name || path.resolve(__dirname, './plugins/pluginDefinition'));
    return PluginClass;
}
exports.getPluginDefinition = getPluginDefinition;
//# sourceMappingURL=pluginsManager.js.map