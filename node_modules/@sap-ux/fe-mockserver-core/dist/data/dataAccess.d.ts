import type { EntitySet, EntityType, NavigationProperty, Singleton } from '@sap-ux/vocabularies-types';
import type { ILogger } from '@ui5/logger';
import type { ServiceConfig } from '../api';
import type { IFileLoader } from '../index';
import type { FileBasedMockData } from '../mockdata/fileBasedMockData';
import type { ExpandDefinition, KeyDefinitions } from '../request/odataRequest';
import ODataRequest from '../request/odataRequest';
import type { IncomingMessageWithTenant } from '../router/serviceRouter';
import type { DataAccessInterface, EntitySetInterface } from './common';
import { MockDataEntitySet } from './entitySets/entitySet';
import { StickyMockEntitySet } from './entitySets/stickyEntitySet';
import type { ODataMetadata } from './metadata';
import type { ServiceRegistry } from './serviceRegistry';
type ApplyToExpandTreeFunction = (this: DataAccess, data: Record<string, any>, entityType: EntityType, navigationProperty: NavigationProperty, targetEntitySet: EntitySet | Singleton | undefined, expandDefinition: ExpandDefinition, odataRequest: ODataRequest) => Promise<void>;
type Data = Record<string, any> | undefined | null;
/**
 *
 */
export declare class DataAccess implements DataAccessInterface {
    private service;
    private metadata;
    fileLoader: IFileLoader;
    logger: ILogger | undefined;
    private readonly serviceRegistry;
    protected readonly mockDataRootFolder: string;
    debug: boolean;
    logRequests: boolean;
    logResponses: boolean;
    log: ILogger;
    protected readonly strictKeyMode: boolean;
    protected readonly contextBasedIsolation: boolean;
    protected validateETag: boolean;
    protected entitySets: Record<string, MockDataEntitySet>;
    protected stickyEntitySets: StickyMockEntitySet[];
    protected generateMockData: boolean;
    protected forceNullableValuesToNull: boolean;
    private allowInlineNull;
    constructor(service: ServiceConfig, metadata: ODataMetadata, fileLoader: IFileLoader, logger: ILogger | undefined, serviceRegistry: ServiceRegistry);
    isV4(): boolean;
    shouldValidateETag(): boolean;
    private initializeMockData;
    reloadData(newMetadata?: ODataMetadata): void;
    logRequest(message: string, odataRequest: ODataRequest): void;
    private logResponse;
    getMockEntitySet(entityTypeName?: string, generateMockData?: boolean, forceNullableValuesToNull?: boolean, containedEntityType?: EntityType, containedData?: any): Promise<EntitySetInterface>;
    performAction(odataRequest: ODataRequest, bodyActionData?: Record<string, unknown> & {
        _type?: string;
    }): Promise<any>;
    getNavigationPropertyKeys(data: any, navPropDetail: NavigationProperty, currentEntityType: EntityType, currentEntitySet: EntitySet | Singleton | undefined, currentKeys: KeyDefinitions, tenantId: string, forCreate?: boolean): Promise<KeyDefinitions>;
    applyToExpandTree(currentEntitySet: EntitySet | Singleton | undefined, entityType: EntityType, expandNavProp: string, data: Data | Data[], requestExpandObject: Record<string, ExpandDefinition>, previousEntitySet: EntitySet | Singleton | undefined, visitedPaths: string[], odataRequest: ODataRequest, functionToApply: ApplyToExpandTreeFunction): Promise<Data>;
    /**
     * Applies $expand.
     *
     * @param data               The data to expand
     * @param entityType         Entity type of the data
     * @param navigationProperty The navigation property to expand
     * @param targetEntitySet    The expanded entity set
     * @param _expandDefinition
     * @param odataRequest
     */
    private applyExpand;
    /**
     * Applies $select.
     *
     * @param data              Data to process
     * @param selectDefinition  Selected properties
     * @param expandDefinitions Expanded properties
     * @param entityType        Entity type of the data
     * @param odataRequest      The odata request
     */
    private applySelect;
    /**
     * Applies post-processing of expand options, such as removing properties that were not selected.
     *
     * @param data  The data to process
     * @param _entityType  Entity type of the data
     * @param navigationProperty  The expanded navigation property to process
     * @param targetEntitySet   The target entity set of the expanded navigation property
     * @param expandDefinition  The expand definition with all parameters
     * @param odataRequest
     */
    private applyExpandOptions;
    /**
     * Get the OData metadata for this service.
     *
     * @returns The OData metadata
     */
    getMetadata(): ODataMetadata;
    /**
     * Get access to an entity interface from a different service for cross-service communication.
     *
     * @param serviceNameOrAlias - The name/path or alias of the target service
     * @param entityName - The name of the entity in the target service
     * @param tenantId - The tenant ID to use for cross-service access (defaults to 'tenant-default')
     * @returns The entity interface or undefined if not found
     */
    getCrossServiceEntityInterface(serviceNameOrAlias: string, entityName: string, tenantId?: string): Promise<FileBasedMockData | undefined>;
    getServiceRegistry(): ServiceRegistry;
    /**
     * Get data based on an OData request.
     *
     * @param odataRequest - The OData request
     * @param dontClone - Whether to avoid cloning the data
     * @param ignoreRequestOperation - Whether we ignore operation on the odataRequest
     * @returns The requested data
     */
    getData(odataRequest: ODataRequest, dontClone?: boolean, ignoreRequestOperation?: boolean): Promise<any>;
    updateData(odataRequest: ODataRequest, patchData: any): Promise<any>;
    createData(odataRequest: ODataRequest, postData: any): Promise<any>;
    private addV2Metadata;
    private getV2KeyString;
    deleteData(odataRequest: ODataRequest): Promise<void>;
    getDraftRoot(keyValues: KeyDefinitions, _tenantId: string, entitySetDefinition: EntitySet): Promise<{}>;
    /**
     * Check whether there is a valid session with the given context ID.
     *
     * @param request The incoming request
     * @throws ExecutionError if there is a context ID, but there is no corresponding session
     */
    checkSession(request: ODataRequest | IncomingMessageWithTenant): void;
    resetStickySessionTimeout(odataRequest: ODataRequest): void;
    private _applyOrderBy;
    private _applyGroupBy;
    private _applyFilter;
    private lastFilterTransformationResult;
    private applyTransformation;
}
export {};
//# sourceMappingURL=dataAccess.d.ts.map