import type { Action, EntitySet, EntityType, Property } from '@sap-ux/vocabularies-types';
import { FileBasedMockData } from '../../mockdata/fileBasedMockData';
import type { FilterExpression, FilterMethodCall } from '../../request/filterParser';
import type { KeyDefinitions } from '../../request/odataRequest';
import ODataRequest from '../../request/odataRequest';
import type { DataAccessInterface, EntitySetInterface } from '../common';
import type { ServiceRegistry } from '../serviceRegistry';
type PreparedFunction = {
    fn: Function;
    type: string;
};
/**
 *
 */
export declare class MockDataEntitySet implements EntitySetInterface {
    private _resolvedProperties;
    generateMockData: boolean;
    static read(mockDataRootFolder: string, entity: string, generateMockData: boolean, forceNullableValuesToNull: boolean, isDraft: boolean, dataAccess: DataAccessInterface): Promise<object[]>;
    protected _rootMockData: object[];
    private _rootMockDataFn;
    protected contextBasedMockData: Record<string, FileBasedMockData>;
    readyPromise: Promise<EntitySetInterface>;
    protected entitySetDefinition: EntitySet | null;
    protected entityTypeDefinition: EntityType;
    protected dataAccess: DataAccessInterface;
    /**
     * @param rootFolder
     * @param entitySetDefinition
     * @param dataAccess
     * @param generateMockData
     * @param forceNullableValuesToNull
     * @param initializeMockData
     * @param isDraft
     */
    constructor(rootFolder: string, entitySetDefinition: EntitySet | EntityType, dataAccess: DataAccessInterface, generateMockData: boolean, forceNullableValuesToNull: boolean, initializeMockData?: boolean, isDraft?: boolean);
    getMockData(contextId: string): FileBasedMockData;
    protected checkKeys(keyValues: KeyDefinitions, dataLine: object, keyDefinition: Property[]): boolean;
    protected checkSpecificProperties(_filterExpression: any, _mockData: any, _allData: any, _odataRequest: any): boolean | null;
    isV4(): boolean;
    shouldValidateETag(): boolean;
    isDraft(): boolean;
    getProperty(identifier: string): Property;
    checkFilter(mockData: object, filterExpression: FilterExpression, tenantId: string, odataRequest: ODataRequest): boolean;
    createTransformation(identifier: string | FilterMethodCall, isProperty?: boolean): PreparedFunction;
    checkSimpleExpression(filterExpression: any, mockData: any, tenantId: string, odataRequest: ODataRequest): any;
    private checkLambdaExpression;
    checkSearch(mockData: any, searchQueries: string[], _odataRequest: ODataRequest): boolean;
    checkKeyValue(mockData: any, keyValues: any, keyName: string, keyProp?: Property): boolean;
    getKeys(dataLine: any): Record<string, string | number | boolean>;
    protected prepareKeys(keyValues: KeyDefinitions): KeyDefinitions;
    performGET(keyValues: KeyDefinitions, asArray: boolean, tenantId: string, odataRequest: ODataRequest, dontClone?: boolean): Promise<any>;
    performPOST(keyValues: KeyDefinitions, postData: any, tenantId: string, odataRequest: ODataRequest, _updateParent?: boolean): Promise<any>;
    performPATCH(keyValues: KeyDefinitions, patchData: any, tenantId: string, odataRequest: ODataRequest, _updateParent?: boolean): Promise<any>;
    performDELETE(keyValues: KeyDefinitions, tenantId: string, odataRequest: ODataRequest, _updateParent?: boolean): Promise<void>;
    executeAction(actionDefinition: Action, actionData: object | undefined, odataRequest: ODataRequest, keys: Record<string, any>): Promise<any>;
    getParentEntityInterface(tenantId: string): Promise<FileBasedMockData | undefined>;
    getEntityInterface(entitySet: string, serviceNameOrAlias: string | undefined, tenantId: string): Promise<FileBasedMockData | undefined>;
    getServiceRegistry(): ServiceRegistry;
    logRequest(message: string, odataRequest: ODataRequest): void;
}
export {};
//# sourceMappingURL=entitySet.d.ts.map