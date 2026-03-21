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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRegistry = void 0;
const etag_1 = __importDefault(require("etag"));
const router_1 = __importDefault(require("router"));
const logger_1 = require("../logger");
const pluginsManager_1 = require("../pluginsManager");
const catalogServiceRouter_1 = require("../router/catalogServiceRouter");
const serviceRouter_1 = require("../router/serviceRouter");
const dataAccess_1 = require("./dataAccess");
const metadata_1 = require("./metadata");
/**
 * Escape the path provided for the annotation URL so that they can fit the regex pattern from Router.
 *
 * @param strValue
 * @returns the encoded string
 */
function escapeRegex(strValue) {
    return strValue.replace(/[-\\^$+?()|[\]{}]/g, '\\$&');
}
/**
 * Encode single quotes and asterisks in the string.
 *
 * @param str the string to encode
 * @returns the encoded string
 */
function encode(str) {
    return str.replaceAll("'", '%27').replaceAll('*', '%2A');
}
async function loadMetadata(service, metadataProcessor) {
    const edmx = await metadataProcessor.loadMetadata(service.metadataPath);
    if (!service.noETag) {
        service.ETag = (0, etag_1.default)(edmx, { weak: true });
    }
    return metadata_1.ODataMetadata.parse(edmx, service.urlPath + '/$metadata', service.ETag);
}
/**
 * Registry for managing services in the mockserver.
 * Handles service creation, middleware setup, and registration on app routers.
 * Also manages cross-service communication by allowing services to access entity interfaces from other services.
 */
class ServiceRegistry {
    constructor(fileLoader, metadataProcessor, app) {
        this.fileLoader = fileLoader;
        this.metadataProcessor = metadataProcessor;
        this.app = app;
        this.services = new Map();
        this.aliases = new Map();
        this.registrations = new Map();
        this.watchers = [];
        this.isOpened = false;
    }
    /**
     * Load and prepare services from MockserverConfiguration.
     * This replaces the createServiceMiddlewares function logic.
     *
     * @param config the mockserver configuration
     */
    async loadDefaultServices(config) {
        var _a;
        this.config = config;
        const log = (_a = config.logger) !== null && _a !== void 0 ? _a : (0, logger_1.getLogger)('server:ux-fe-mockserver', !!config.debug);
        if (config.services.length === 0) {
            log.info('No services configured. Skipping mockserver setup.');
            return;
        }
        await Promise.all(config.services.map((config) => this.createServiceRegistration(config, log)));
    }
    async loadServices(serviceConfigs) {
        var _a;
        const log = (_a = this.config.logger) !== null && _a !== void 0 ? _a : (0, logger_1.getLogger)('server:ux-fe-mockserver', !!this.config.debug);
        if (serviceConfigs.length === 0) {
            log.info('No services configured. Skipping mockserver setup.');
            return;
        }
        await Promise.all(serviceConfigs.map((config) => this.createServiceRegistration(config, log)));
    }
    /**
     * Create a service registration for a given service configuration.
     * This includes loading metadata, setting up data access, and registering the service handler.
     *
     * @param mockServiceIn the service configuration to register
     * @param log the logger instance to use for logging
     */
    async createServiceRegistration(mockServiceIn, log) {
        const mockService = mockServiceIn;
        if (mockService.logRequests === undefined && this.config.logRequests !== undefined) {
            mockService.logRequests = this.config.logRequests;
            mockService.logResponses = this.config.logResponses;
        }
        const splittedPath = mockService.urlPath.split('/');
        mockService._internalName = splittedPath[splittedPath.length - 1];
        if (mockService.watch) {
            log.info(`Service ${mockService.urlPath} is running in watch mode`);
        }
        try {
            let processor = this.metadataProcessor;
            // handle service-specific metadata processor override
            if (mockService.metadataProcessor) {
                log.info(`Loading service-specific metadata processor for ${mockService.urlPath}: ${JSON.stringify(mockService.metadataProcessor)}`);
                processor = await (0, pluginsManager_1.getMetadataProcessor)(this.fileLoader, mockService.metadataProcessor.name, mockService.metadataProcessor.options, mockServiceIn.i18nPath);
            }
            else {
                processor.addI18nPath(mockServiceIn.i18nPath);
            }
            let metadata;
            if (!mockService.metadataPath && !mockService.__captureAndSimulate) {
                throw new Error(`No metadata path provided for service ${mockService.urlPath}`);
            }
            else if (mockService.__captureAndSimulate) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                metadata = new metadata_1.ODataMetadata({
                    entitySets: [],
                    entityTypes: []
                }, {}, '', ''); // Metadata will be captured at runtime
            }
            else {
                metadata = await loadMetadata(mockService, processor);
            }
            const dataAccess = new dataAccess_1.DataAccess(mockService, metadata, this.fileLoader, this.config.logger, this);
            if (mockServiceIn.resolveExternalServiceReferences === true && metadata) {
                const references = metadata.getExternalServices(mockService.metadataPath);
                await Promise.allSettled(references.map(async (reference) => {
                    const exists = await this.fileLoader.exists(reference.localPath);
                    if (!exists) {
                        log.info(`External service metadata file not found at "${reference.localPath}". Service "${reference.externalServiceMetadataPath}" will not be provided.`);
                        return undefined;
                    }
                    return this.createServiceRegistration({
                        metadataPath: reference.localPath,
                        urlPath: reference.externalServiceMetadataPath,
                        generateMockData: false,
                        mockdataPath: reference.dataPath,
                        watch: false
                    }, log);
                }));
            }
            // Register this service for cross-service access
            this.registerService(mockService.urlPath, dataAccess, mockService.alias);
            if (mockService.watch) {
                const watchPath = [mockService.mockdataPath];
                if (mockService.metadataPath) {
                    watchPath.push(mockService.metadataPath);
                }
                const chokidar = await Promise.resolve().then(() => __importStar(require('chokidar')));
                const watcher = chokidar
                    .watch(watchPath, {
                    ignoreInitial: true
                })
                    .on('all', async function (event, path) {
                    log.info(`Change detected for service ${mockService.urlPath}... restarting`);
                    if (mockService.debug) {
                        log.info(`${event} on ${path}`);
                    }
                    metadata = await loadMetadata(mockService, processor);
                    dataAccess.reloadData(metadata);
                    log.info(`Service ${mockService.urlPath} restarted`);
                });
                this.watchers.push(watcher);
            }
            const oDataHandlerInstance = await (0, serviceRouter_1.serviceRouter)(mockService, dataAccess);
            if (mockService.debug) {
                log.info(`Mockdata location: ${mockService.mockdataPath}`);
                log.info(`Service path: ${mockService.urlPath}`);
            }
            const registration = { service: mockService, handler: oDataHandlerInstance };
            if (this.isOpened) {
                this.attachServiceHandler(registration, log);
            }
            this.registrations.set(mockService.urlPath, registration);
        }
        catch (e) {
            log.error(e);
            throw new Error('Failed to start ' + JSON.stringify(mockService, null, 4));
        }
    }
    /**
     * Open the service registry by registering all loaded services on the provided app router.
     * This replaces the registerServiceMiddlewares and prepareCatalogAndAnnotation function logic.
     */
    open() {
        var _a;
        if (!this.config || !this.fileLoader) {
            throw new Error('ServiceRegistry must be loaded with services before opening');
        }
        const log = (_a = this.config.logger) !== null && _a !== void 0 ? _a : (0, logger_1.getLogger)('server:ux-fe-mockserver', !!this.config.debug);
        // Register each service on the app
        for (const registration of this.registrations.values()) {
            this.attachServiceHandler(registration, log);
        }
        // Prepare the catalog service
        this.app.use('/sap/opu/odata/IWFND/CATALOGSERVICE;v=2', (0, catalogServiceRouter_1.catalogServiceRouter)(this.config.services));
        // Prepare the annotation files
        for (const mockAnnotation of this.config.annotations || []) {
            let escapedPath = escapeRegex(mockAnnotation.urlPath);
            if (escapedPath.endsWith('*')) {
                escapedPath += 'rest';
            }
            this.app.get(escapedPath, async (_req, res) => {
                try {
                    const data = await this.fileLoader.loadFile(mockAnnotation.localPath);
                    res.setHeader('Content-Type', 'application/xml');
                    res.write(data);
                    res.end();
                }
                catch (error) {
                    console.error(error);
                }
            });
        }
        this.isOpened = true;
    }
    attachServiceHandler(registration, log) {
        const mockService = registration.service;
        const oDataHandlerInstance = registration.handler;
        if (mockService.contextBasedIsolation || this.config.contextBasedIsolation) {
            const subRouter = new router_1.default();
            try {
                subRouter.use(mockService.urlPath, oDataHandlerInstance);
            }
            catch {
                // Can happen if the URL contains asterisks. As the encoded path is registered below, this might not
                // be a problem since clients usually call the encoded path.
                log.error(`Could not register service path: ${mockService.urlPath}`);
            }
            subRouter.use(encode(mockService.urlPath), oDataHandlerInstance);
            this.app.use(/^\/tenant-(\d{1,3})/, subRouter);
        }
        try {
            this.app.use(mockService.urlPath, oDataHandlerInstance);
        }
        catch {
            // Can happen if the URL contains asterisks. As the encoded path is registered below, this might not
            // be a problem since clients usually call the encoded path.
            log.error(`Could not register path: ${mockService.urlPath}`);
        }
        this.app.use(encode(mockService.urlPath), oDataHandlerInstance);
    }
    /**
     * Get all service registrations for backward compatibility.
     *
     * @returns Array of service registrations
     */
    getRegistrations() {
        return Array.from(this.registrations.values());
    }
    /**
     * Register a service with its DataAccess instance.
     *
     * @param serviceName - The name/path of the service
     * @param dataAccess - The DataAccess instance for this service
     * @param alias - Optional alias for easier reference
     */
    registerService(serviceName, dataAccess, alias) {
        this.services.set(serviceName, dataAccess);
        if (alias) {
            this.aliases.set(alias, serviceName);
        }
    }
    /**
     * Get a DataAccess instance for a specific service.
     *
     * @param serviceNameOrAlias - The name/path or alias of the service
     * @returns The DataAccess instance or undefined if not found
     */
    getService(serviceNameOrAlias) {
        // First try to get by alias
        const serviceName = this.aliases.get(serviceNameOrAlias);
        if (serviceName) {
            return this.services.get(serviceName);
        }
        // Fallback to direct service name lookup
        return this.services.get(serviceNameOrAlias);
    }
    getServices() {
        return Array.from(this.registrations.values()).map((reg) => reg.service);
    }
    /**
     * Get all registered service names.
     *
     * @returns Array of service names
     */
    getServiceNames() {
        return Array.from(this.services.keys());
    }
    /**
     * Get all registered service aliases.
     *
     * @returns Array of service aliases
     */
    getServiceAliases() {
        return Array.from(this.aliases.keys());
    }
    /**
     * Get a formatted list of all services with their aliases (if any).
     *
     * @returns String showing all services and their aliases
     */
    getServicesWithAliases() {
        const serviceNames = Array.from(this.services.keys());
        return serviceNames
            .map((serviceName) => {
            var _a;
            // Find alias for this service
            const alias = (_a = Array.from(this.aliases.entries()).find(([, name]) => name === serviceName)) === null || _a === void 0 ? void 0 : _a[0];
            return alias ? `${serviceName} (alias: ${alias})` : serviceName;
        })
            .join(', ');
    }
    async dispose() {
        for (const watcher of this.watchers) {
            await watcher.close();
        }
    }
}
exports.ServiceRegistry = ServiceRegistry;
//# sourceMappingURL=serviceRegistry.js.map