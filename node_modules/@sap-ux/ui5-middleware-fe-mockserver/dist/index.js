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
const fe_mockserver_core_1 = __importStar(require("@sap-ux/fe-mockserver-core"));
const path = __importStar(require("path"));
const configResolver_1 = require("./configResolver");
async function FEMiddleware(middlewareConfig) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // basepath will be the webapp folder so we have to go up a level to retrieve the config
    let basePath = (_c = (_b = (_a = middlewareConfig === null || middlewareConfig === void 0 ? void 0 : middlewareConfig.resources) === null || _a === void 0 ? void 0 : _a.rootProject) === null || _b === void 0 ? void 0 : _b._readers[0]) === null || _c === void 0 ? void 0 : _c._fsBasePath;
    if (basePath) {
        basePath = path.resolve(middlewareConfig.resources.rootProject._readers[0]._fsBasePath, '..');
    }
    else {
        basePath = (_h = (_g = (_f = (_e = (_d = middlewareConfig === null || middlewareConfig === void 0 ? void 0 : middlewareConfig.resources) === null || _d === void 0 ? void 0 : _d.rootProject) === null || _e === void 0 ? void 0 : _e._readers[1]) === null || _f === void 0 ? void 0 : _f._project) === null || _g === void 0 ? void 0 : _g._modulePath) !== null && _h !== void 0 ? _h : '';
    }
    const mockserverInstance = new fe_mockserver_core_1.default((0, configResolver_1.resolveConfig)(middlewareConfig.options.configuration, basePath));
    await mockserverInstance.isReady;
    return mockserverInstance.getRouter();
}
FEMiddleware.MockDataContributorClass = fe_mockserver_core_1.MockDataContributorClass;
FEMiddleware.MockEntityContainerContributorClass = fe_mockserver_core_1.MockEntityContainerContributorClass;
module.exports = FEMiddleware;
//# sourceMappingURL=index.js.map