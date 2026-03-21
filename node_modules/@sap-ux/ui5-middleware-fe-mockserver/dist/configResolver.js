"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConfig = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function isFolderBasedConfig(serverConfig) {
    return serverConfig.mockFolder !== undefined;
}
function isAnnotationConfig(serverConfig) {
    var _a;
    return ((_a = serverConfig.type) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'annotation';
}
function prepareFolderBasedConfig(currentBasePath, inAnnotations, inServices) {
    let mockConfig;
    let isTSNodeThere;
    try {
        require.resolve('ts-node');
        isTSNodeThere = process.env.CDS_TYPESCRIPT !== 'tsx';
    }
    catch (e) {
        isTSNodeThere = false;
    }
    if (isTSNodeThere && fs_1.default.existsSync(path_1.default.join(currentBasePath, 'config.ts'))) {
        // we need to register ts-node to be able to load ts files
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('ts-node').register({
            transpileOnly: true,
            compilerOptions: {
                module: 'commonjs'
            }
        });
        mockConfig = require(path_1.default.join(currentBasePath, 'config.ts'));
    }
    else if (fs_1.default.existsSync(path_1.default.join(currentBasePath, 'config.mjs'))) {
        mockConfig = require(path_1.default.join(currentBasePath, 'config.mjs'));
    }
    else if (fs_1.default.existsSync(path_1.default.join(currentBasePath, 'config.js'))) {
        mockConfig = require(path_1.default.join(currentBasePath, 'config.js'));
    }
    else {
        mockConfig = JSON.parse(fs_1.default.readFileSync(path_1.default.join(currentBasePath, 'config.json')).toString('utf-8'));
    }
    mockConfig.forEach((mockConfigEntry) => {
        if (isAnnotationConfig(mockConfigEntry)) {
            delete mockConfigEntry.type;
            inAnnotations.push(mockConfigEntry);
        }
        else {
            inServices.push(mockConfigEntry);
        }
    });
}
function prepareFileBasedConfig(inConfig) {
    let inServiceFromConfig = inConfig.service ? inConfig.service : inConfig.services;
    if (!Array.isArray(inServiceFromConfig) && inServiceFromConfig !== undefined) {
        inServiceFromConfig = [inServiceFromConfig];
    }
    else if (inServiceFromConfig === undefined) {
        inServiceFromConfig = [];
    }
    const inServices = inServiceFromConfig;
    let inAnnotationsFromConfig = inConfig.annotations;
    if (!Array.isArray(inAnnotationsFromConfig) && inAnnotationsFromConfig !== undefined) {
        inAnnotationsFromConfig = [inAnnotationsFromConfig];
    }
    else if (inAnnotationsFromConfig === undefined) {
        inAnnotationsFromConfig = [];
    }
    const inAnnotations = inAnnotationsFromConfig;
    inAnnotations.forEach((annotationConfig) => annotationConfig.type === 'Annotation');
    return { inServices, inAnnotations };
}
/**
 * Ensure that each service configuration is properly resolved including all file path.
 *
 * @param inServices
 * @param currentBasePath
 * @param inConfig
 * @returns an up to date configuration for one service
 */
function processServicesConfig(inServices, currentBasePath, inConfig) {
    const propertiesToOverride = [
        'watch',
        'noETag',
        'debug',
        'logger',
        'logRequests',
        'logResponses',
        'strictKeyMode',
        'contextBasedIsolation',
        'generateMockData',
        'forceNullableValuesToNull',
        'allowInlineNull',
        'validateETag'
    ];
    return inServices.map((inService) => {
        const myServiceConfig = {
            watch: inService.watch,
            urlPath: inService.urlPath,
            alias: inService.alias,
            noETag: inService.noETag,
            validateETag: inService.validateETag,
            logger: inService.logger,
            logRequests: inService.logRequests,
            logResponses: inService.logResponses,
            debug: inService.debug,
            strictKeyMode: inService.strictKeyMode,
            generateMockData: inService.generateMockData,
            contextBasedIsolation: inService.contextBasedIsolation,
            forceNullableValuesToNull: inService.forceNullableValuesToNull,
            resolveExternalServiceReferences: inService.resolveExternalServiceReferences,
            metadataProcessor: inService.metadataProcessor,
            i18nPath: inService.i18nPath,
            __captureAndSimulate: inService.__captureAndSimulate
        };
        const metadataPath = inService.metadataPath || inService.metadataXmlPath || inService.metadataCdsPath;
        if (metadataPath) {
            myServiceConfig.metadataPath = path_1.default.resolve(currentBasePath, metadataPath);
        }
        const mockDataPath = inService.mockdataPath || inService.mockdataRootPath;
        if (mockDataPath) {
            myServiceConfig.mockdataPath = path_1.default.resolve(currentBasePath, mockDataPath);
        }
        else if (myServiceConfig.metadataPath) {
            // we default to the folder of the metadata
            myServiceConfig.mockdataPath = path_1.default.dirname(myServiceConfig.metadataPath);
        }
        else {
            // defult to the base folder
            myServiceConfig.mockdataPath = currentBasePath;
        }
        if (!inService.urlPath) {
            myServiceConfig.urlPath = inService.urlBasePath + '/' + inService.name;
        }
        propertiesToOverride.forEach((property) => {
            if (inConfig[property] !== undefined && !inService.hasOwnProperty(property)) {
                myServiceConfig[property] = inConfig[property];
            }
        });
        return myServiceConfig;
    });
}
function resolveConfig(inConfig, basePath) {
    let inServices = [];
    let inAnnotations = [];
    let currentBasePath = basePath;
    if (isFolderBasedConfig(inConfig)) {
        inConfig.mockFolder = path_1.default.resolve(basePath, inConfig.mockFolder);
        currentBasePath = inConfig.mockFolder;
        prepareFolderBasedConfig(currentBasePath, inAnnotations, inServices);
    }
    else {
        const __ret = prepareFileBasedConfig(inConfig);
        inServices = __ret.inServices;
        inAnnotations = __ret.inAnnotations;
    }
    const annotations = inAnnotations.map((inAnnotation) => {
        inAnnotation.localPath = path_1.default.resolve(currentBasePath, inAnnotation.localPath);
        return inAnnotation;
    });
    const services = processServicesConfig(inServices, currentBasePath, inConfig);
    return {
        contextBasedIsolation: !!inConfig.contextBasedIsolation,
        watch: !!inConfig.watch,
        strictKeyMode: !!inConfig.strictKeyMode,
        debug: !!inConfig.debug,
        logger: inConfig.logger,
        logRequests: !!inConfig.logRequests,
        logResponses: !!inConfig.logResponses,
        generateMockData: !!inConfig.generateMockData,
        annotations: annotations,
        services: services,
        tsConfigPath: inConfig.tsConfigPath ? path_1.default.resolve(basePath, inConfig.tsConfigPath) : undefined,
        fileLoader: inConfig.fileLoader,
        metadataProcessor: inConfig.metadataProcessor,
        plugins: inConfig.plugins
    };
}
exports.resolveConfig = resolveConfig;
//# sourceMappingURL=configResolver.js.map