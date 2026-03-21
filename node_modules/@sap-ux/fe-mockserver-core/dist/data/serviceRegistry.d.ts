import type { IRouter } from 'router';
import type { MockserverConfiguration, ServiceConfig, ServiceConfigEx } from '../api';
import type { IFileLoader, IMetadataProcessor } from '../index';
import type { DataAccessInterface } from './common';
export type ServiceRegistration = {
    service: ServiceConfigEx;
    handler: IRouter;
};
/**
 * Registry for managing services in the mockserver.
 * Handles service creation, middleware setup, and registration on app routers.
 * Also manages cross-service communication by allowing services to access entity interfaces from other services.
 */
export declare class ServiceRegistry {
    private readonly fileLoader;
    private readonly metadataProcessor;
    private readonly app;
    private readonly services;
    private readonly aliases;
    private readonly registrations;
    private readonly watchers;
    private config;
    private isOpened;
    constructor(fileLoader: IFileLoader, metadataProcessor: IMetadataProcessor, app: IRouter);
    /**
     * Load and prepare services from MockserverConfiguration.
     * This replaces the createServiceMiddlewares function logic.
     *
     * @param config the mockserver configuration
     */
    loadDefaultServices(config: MockserverConfiguration): Promise<void>;
    loadServices(serviceConfigs: ServiceConfig[]): Promise<void>;
    /**
     * Create a service registration for a given service configuration.
     * This includes loading metadata, setting up data access, and registering the service handler.
     *
     * @param mockServiceIn the service configuration to register
     * @param log the logger instance to use for logging
     */
    private createServiceRegistration;
    /**
     * Open the service registry by registering all loaded services on the provided app router.
     * This replaces the registerServiceMiddlewares and prepareCatalogAndAnnotation function logic.
     */
    open(): void;
    private attachServiceHandler;
    /**
     * Get all service registrations for backward compatibility.
     *
     * @returns Array of service registrations
     */
    getRegistrations(): ServiceRegistration[];
    /**
     * Register a service with its DataAccess instance.
     *
     * @param serviceName - The name/path of the service
     * @param dataAccess - The DataAccess instance for this service
     * @param alias - Optional alias for easier reference
     */
    registerService(serviceName: string, dataAccess: DataAccessInterface, alias?: string): void;
    /**
     * Get a DataAccess instance for a specific service.
     *
     * @param serviceNameOrAlias - The name/path or alias of the service
     * @returns The DataAccess instance or undefined if not found
     */
    getService(serviceNameOrAlias: string): DataAccessInterface | undefined;
    getServices(): ServiceConfig[];
    /**
     * Get all registered service names.
     *
     * @returns Array of service names
     */
    getServiceNames(): string[];
    /**
     * Get all registered service aliases.
     *
     * @returns Array of service aliases
     */
    getServiceAliases(): string[];
    /**
     * Get a formatted list of all services with their aliases (if any).
     *
     * @returns String showing all services and their aliases
     */
    getServicesWithAliases(): string;
    dispose(): Promise<void>;
}
//# sourceMappingURL=serviceRegistry.d.ts.map