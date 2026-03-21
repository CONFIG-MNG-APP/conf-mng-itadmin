import type { Action, ComplexType, EntityType, NavigationProperty, Property, PropertyPath, TypeDefinition } from '@sap-ux/vocabularies-types';
import type { PathAnnotationExpression } from '@sap-ux/vocabularies-types/Edm';
import type { RecursiveHierarchy } from '@sap-ux/vocabularies-types/vocabularies/Aggregation';
import type { EntitySetInterface, PartialReferentialConstraint, ServiceRegistryInterface } from '../data/common';
import type { AncestorDescendantsParameters, TopLevelParameters } from '../request/applyParser';
import type ODataRequest from '../request/odataRequest';
import type { KeyDefinitions } from '../request/odataRequest';
type HierarchyDefinition = {
    distanceFromRootProperty: string | undefined;
    drillStateProperty: string | undefined;
    matchedDescendantCountProperty: string | undefined;
    matchedProperty: string | undefined;
    limitedDescendantCountProperty: string | undefined;
    limitedRankProperty: string | undefined;
    sourceReference: string;
};
type ToExpand = {
    name: string;
    depth: number;
};
export declare function isPropertyPathExpression(expression: unknown): expression is PropertyPath;
export declare function isPathExpression(expression: unknown): expression is PathAnnotationExpression<Property>;
export declare function getPathOrPropertyPath(expression: unknown): string | undefined;
/**
 *
 */
export declare class FileBasedMockData {
    protected _mockData: object[];
    protected _keyIndex: Record<string, Record<string, number> | false>;
    protected _hierarchyTree: Record<string, Record<string, any>>;
    protected _entityType: EntityType;
    protected _mockDataEntitySet: EntitySetInterface;
    protected _contextId: string;
    protected __generateMockData: boolean;
    protected __forceNullableValuesToNull: boolean;
    constructor(mockData: any[], entityType: EntityType, mockDataEntitySet: EntitySetInterface, contextId: string);
    private validateProperties;
    cleanupHierarchies(): void;
    private cleanupHierarchyData;
    addEntry(mockEntry: any, _odataRequest: ODataRequest): Promise<void>;
    updateEntry(keyValues: KeyDefinitions, updatedData: any, _patchData: object, _odataRequest: ODataRequest): Promise<void>;
    fetchIndexFromKey(keys: Property[], keyValues: KeyDefinitions, _odataRequest: ODataRequest): number | false;
    fetchEntries(keyValues: KeyDefinitions, _odataRequest: ODataRequest): Promise<object[]>;
    hasEntry(keyValues: KeyDefinitions, _odataRequest: ODataRequest): boolean;
    hasEntries(_odataRequest: ODataRequest): boolean;
    getAllEntries(_odataRequest: ODataRequest, dontClone?: boolean): Promise<any[]>;
    protected createKeyIndex(keys?: string[]): false | Record<string, number>;
    protected getDataIndex(keyValues: KeyDefinitions, _odataRequest: ODataRequest): number;
    private checkKeyValues;
    /**
     *
     * @param keyValues
     * @param _odataRequest
     */
    removeEntry(keyValues: KeyDefinitions, _odataRequest: ODataRequest): Promise<void>;
    protected getDefaultValueFromType(property: Property, type: string, complexType: ComplexType | TypeDefinition | undefined, defaultValue?: any, allowEmptyKeys?: boolean): any;
    protected getRandomValueFromType(property: Property, complexType: ComplexType | TypeDefinition | undefined, propertyName: string, lineIndex: number): any;
    getEmptyObject(_odataRequest: ODataRequest, allowEmptyKeys?: boolean): object;
    getDefaultElement(_odataRequest: ODataRequest): object;
    generateKey(property: Property, lineIndex?: number, mockData?: any): string | number | boolean;
    generateMockDataLine(iIndex: number, mockData: any): any;
    getParentEntityInterface(): Promise<FileBasedMockData | undefined>;
    getEntityInterface(entitySetName: string, serviceNameOrAlias?: string): Promise<FileBasedMockData | undefined>;
    getServiceRegistry(): ServiceRegistryInterface;
    generateMockData(): any[];
    /**
     * Allow to modify the action data beforehand.
     *
     * @param _actionDefinition
     * @param actionData
     * @param _keys
     * @param _odataRequest
     * @returns the modified action data
     */
    onBeforeAction(_actionDefinition: Action, actionData: any, _keys: Record<string, any>, _odataRequest: ODataRequest): Promise<object>;
    /**
     * Do something with the action.
     *
     * @param _actionDefinition
     * @param actionData
     * @param _keys
     * @param _odataRequest
     * @returns the action's result
     */
    executeAction(_actionDefinition: Action, actionData: any, _keys: Record<string, any>, _odataRequest: ODataRequest): Promise<object | undefined>;
    /**
     * Allow to modify the response data.
     *
     * @param _actionDefinition
     * @param _actionData
     * @param _keys
     * @param responseData
     * @param _odataRequest
     * @returns the modified response
     */
    onAfterAction(_actionDefinition: Action, _actionData: any, _keys: Record<string, any>, responseData: any, _odataRequest: ODataRequest): Promise<any>;
    /**
     * Allow to modify the draft preparation.
     *
     * @param _actionDefinition
     * @param _responseData
     * @param _keys
     * @param _odataRequest
     */
    onDraftPrepare(_actionDefinition: Action, _responseData: any, _keys: Record<string, any>, _odataRequest: ODataRequest): Promise<void>;
    onAfterUpdateEntry(_keyValues: KeyDefinitions, _updatedData: object, _odataRequest: ODataRequest): Promise<void>;
    onBeforeUpdateEntry(_keyValues: KeyDefinitions, _updatedData: object, _odataRequest: ODataRequest): Promise<void>;
    onAfterAddEntry(_keyValues: KeyDefinitions, _data: object, _odataRequest: ODataRequest): Promise<void>;
    onBeforeAddEntry(_keyValues: KeyDefinitions, _data: object, _odataRequest: ODataRequest): Promise<void>;
    onAfterRead(data: object | object[], _odataRequest: ODataRequest): Promise<object | object[]>;
    hasCustomAggregate(_customAggregateName: string, _odataRequest: ODataRequest): boolean;
    performCustomAggregate(_customAggregateName: string, _dataToAggregate: any[], _odataRequest: ODataRequest): any;
    checkSearchQuery(mockValue: any, searchQuery: string, _odataRequest: ODataRequest): any;
    checkFilterValue(comparisonType: string, mockValue: any, literal: any, operator: string, _odataRequest: ODataRequest): boolean;
    getReferentialConstraints(_navigationProperty: NavigationProperty): PartialReferentialConstraint[] | undefined;
    getSourceReference(aggregationAnnotation: RecursiveHierarchy): string;
    buildTree(hierarchyNode: any, allItems: Record<string, any[]>, idNode: string, depth: number | undefined, parentNode: any): any;
    buildHierarchyTree(hierarchyQualifier: string, inputSet: any[], hierarchyDefinition: HierarchyDefinition, applyToActiveEntity?: boolean): Record<string, any>;
    flattenTree(currentNode: any, outItems: any[], nodeProperty: string, hierarchyDefinition: HierarchyDefinition, depth: number, toExpand?: ToExpand[], toCollapse?: string[], toShow?: string[], toShowAncestors?: string[], forceExpand?: boolean): number;
    getAncestorsOfNode(currentNode: any, outItems: any[], nodeProperty: string, hierarchyDefinition: HierarchyDefinition, depth: number, matchedChildrenCount: number, matchedProperties: any[], isDraft: boolean, applyToActiveEntity: boolean): number;
    getTopLevels(data: any[], _parameters: TopLevelParameters, _odataRequest: ODataRequest): Promise<any[]>;
    getDescendants(inputSet: object[], lastFilterTransformationResult: object[], hierarchyFilter: object[], entityType: EntityType, _parameters: AncestorDescendantsParameters, _odataRequest: ODataRequest): Promise<object[]>;
    /**
     *
     */
    getHierarchyDefinition(hierarchyQualifier: string): HierarchyDefinition;
    /**
     *
     */
    getHierarchyDefinition(hierarchyQualifier: string, excludeSourceRef: true): Omit<HierarchyDefinition, 'sourceReference'>;
    getAncestors(inputSet: object[], lastFilterTransformationResult: object[], limitedHierarchy: object[], entityType: EntityType, _parameters: AncestorDescendantsParameters, _odataRequest: ODataRequest): Promise<object[]>;
}
export {};
//# sourceMappingURL=fileBasedMockData.d.ts.map