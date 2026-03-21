import type { Action, EntitySet, EntityType, NavigationProperty, Property, Singleton } from '@sap-ux/vocabularies-types';
import type { ILogger } from '@ui5/logger';
import type { IFileLoader, ServiceConfig } from '../index';
import type { FileBasedMockData } from '../mockdata/fileBasedMockData';
import type { FilterExpression } from '../request/filterParser';
import type ODataRequest from '../request/odataRequest';
import type { KeyDefinitions } from '../request/odataRequest';
import type { ODataMetadata } from './metadata';
import type { ServiceRegistry } from './serviceRegistry';
export type PartialReferentialConstraint = {
    sourceProperty: string;
    targetProperty: string;
};
export interface EntitySetInterface {
    getProperty(propertyName: string): Property | undefined;
    checkKeyValue(mockData: object, keyValues: object, keyName: string, keyProp?: Property): boolean;
    checkFilter(mockData: object, filterExpression: FilterExpression, tenantId: string, odataRequest: ODataRequest): boolean;
    checkSearch(mockData: object, searchQueries: string[], odataRequest: ODataRequest): boolean;
    executeAction(actionDefinition: Action, actionData: object | undefined, odataRequest: ODataRequest, keys: Record<string, any>): Promise<any>;
    performGET(keyValues: KeyDefinitions, asArray: boolean, tenantId: string, odataRequest: ODataRequest, dontClone?: boolean): Promise<any>;
    performPOST(keyValues: KeyDefinitions, postData: any, tenantId: string, odataRequest: ODataRequest, _updateParent?: boolean): Promise<any>;
    performPATCH(keyValues: KeyDefinitions, patchData: object, tenantId: string, odataRequest: ODataRequest, _updateParent?: boolean): Promise<any>;
    performDELETE(keyValues: KeyDefinitions, tenantId: string, odataRequest: ODataRequest, _updateParent?: boolean): Promise<void>;
    getParentEntityInterface(tenantId: string): Promise<FileBasedMockData | undefined>;
    getEntityInterface(entitySetName: string, serviceNameOrAlias: string | undefined, tenantId: string): Promise<FileBasedMockData | undefined>;
    getServiceRegistry(): ServiceRegistryInterface;
    getMockData(tenantId: string): FileBasedMockData;
    isV4(): boolean;
    shouldValidateETag(): boolean;
    isDraft(): boolean;
    generateMockData: boolean;
    logRequest(message: string, odataRequest: ODataRequest): void;
}
export interface DataAccessInterface {
    isV4(): boolean;
    shouldValidateETag(): boolean;
    getNavigationPropertyKeys(data: any, navPropDetail: NavigationProperty, currentEntityType: EntityType, currentEntitySet: EntitySet | Singleton | undefined, currentKeys: KeyDefinitions, tenantId: string, forCreate?: boolean): Promise<KeyDefinitions>;
    getMockEntitySet(entityTypeName: string, generateMockData?: boolean, forceNullableValuesToNull?: boolean, containedEntityType?: EntityType, containedData?: any): Promise<EntitySetInterface>;
    getData(odataRequest: ODataRequest): Promise<any>;
    getDraftRoot(keyValues: KeyDefinitions, _tenantId: string, entitySetDefinition: EntitySet): any;
    getMetadata(): ODataMetadata;
    getServiceRegistry(): ServiceRegistry;
    getCrossServiceEntityInterface(serviceNameOrAlias: string, entityName: string, tenantId?: string): Promise<FileBasedMockData | undefined>;
    debug: boolean;
    fileLoader: IFileLoader;
    log: ILogger;
    logRequest(message: string, odataRequest: ODataRequest): void;
}
export interface ServiceRegistryInterface {
    loadServices(serviceConfigs: ServiceConfig[]): Promise<void>;
    getService(serviceNameOrAlias: string): DataAccessInterface | undefined;
    getServiceNames(): string[];
    getServiceAliases(): string[];
    getServices(): ServiceConfig[];
}
/**
 *
 */
export declare class ExecutionError extends Error {
    statusCode: number;
    messageData: object;
    isSAPMessage: boolean;
    isCustomError: boolean;
    headers: Record<string, string>;
    isGlobalRequestError: boolean;
    constructor(message: string, statusCode: number, messageData: any, isSAPMessage: boolean, headers?: Record<string, string>, isGlobalRequestError?: boolean);
}
export declare function _getDateTimeOffset(isV4: boolean): string;
/**
 * Generate an ID of a given length.
 *
 * @param length
 * @returns the generated ID
 */
export declare function generateId(length: number): string;
export declare function uuidv4(): string;
export declare function getData(fullData: any, objectPath: string): any;
export declare function setData(currentNode: any, deepProperty: string, value: any): void;
//# sourceMappingURL=common.d.ts.map