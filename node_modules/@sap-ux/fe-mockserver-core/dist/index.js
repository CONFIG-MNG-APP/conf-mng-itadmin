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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ODataRequest = exports.MockEntityContainerContributorClass = exports.MockDataContributorClass = exports.ServiceRegistry = void 0;
const router_1 = __importDefault(require("router"));
const serviceRegistry_1 = require("./data/serviceRegistry");
const pluginsManager_1 = require("./pluginsManager");
const odataRequest_1 = __importDefault(require("./request/odataRequest"));
exports.ODataRequest = odataRequest_1.default;
__exportStar(require("./api"), exports);
var serviceRegistry_2 = require("./data/serviceRegistry");
Object.defineProperty(exports, "ServiceRegistry", { enumerable: true, get: function () { return serviceRegistry_2.ServiceRegistry; } });
var baseContributor_1 = require("./mockdata/baseContributor");
Object.defineProperty(exports, "MockDataContributorClass", { enumerable: true, get: function () { return baseContributor_1.MockDataContributorClass; } });
Object.defineProperty(exports, "MockEntityContainerContributorClass", { enumerable: true, get: function () { return baseContributor_1.MockEntityContainerContributorClass; } });
class FEMockserver {
    constructor(configuration) {
        this.configuration = configuration;
        this.plugins = [];
        this.mainRouter = new router_1.default();
        this.isReady = this.initialize(configuration.tsConfigPath);
    }
    async initialize(tsConfigPath) {
        var _a, _b, _c, _d;
        const FileLoaderClass = this.configuration.fileLoader || (await Promise.resolve().then(() => __importStar(require('./plugins/fileSystemLoader')))).default;
        this.fileLoader = new FileLoaderClass(tsConfigPath);
        this.metadataProvider = await (0, pluginsManager_1.getMetadataProcessor)(this.fileLoader, (_a = this.configuration.metadataProcessor) === null || _a === void 0 ? void 0 : _a.name, (_b = this.configuration.metadataProcessor) === null || _b === void 0 ? void 0 : _b.options, (_c = this.configuration.metadataProcessor) === null || _c === void 0 ? void 0 : _c.i18nPath);
        this.serviceRegistry = new serviceRegistry_1.ServiceRegistry(this.fileLoader, this.metadataProvider, this.mainRouter);
        globalThis.serviceRegistry = this.serviceRegistry;
        // Load services into the registry
        await this.serviceRegistry.loadDefaultServices(this.configuration);
        if (this.configuration.plugins) {
            this.plugins = await Promise.all((_d = this.configuration.plugins) === null || _d === void 0 ? void 0 : _d.map((plugin) => {
                return (0, pluginsManager_1.getPluginDefinition)(this.fileLoader, plugin);
            }));
            for (const plugin of this.plugins) {
                await this.serviceRegistry.loadServices(plugin.services);
            }
        }
        // Open the registry to register all services on the main router
        this.serviceRegistry.open();
    }
    getServiceRegistry() {
        return this.serviceRegistry;
    }
    getRouter() {
        return this.mainRouter;
    }
    async dispose() {
        await this.serviceRegistry.dispose();
    }
}
exports.default = FEMockserver;
//# sourceMappingURL=index.js.map