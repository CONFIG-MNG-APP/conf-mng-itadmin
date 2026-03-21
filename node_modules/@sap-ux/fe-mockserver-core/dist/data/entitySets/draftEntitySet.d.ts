import type { Action, EntitySet, EntityType, Property } from '@sap-ux/vocabularies-types';
import type { FileBasedMockData } from '../../mockdata/fileBasedMockData';
import type ODataRequest from '../../request/odataRequest';
import type { KeyDefinitions } from '../../request/odataRequest';
import type { DataAccessInterface } from '../common';
import { MockDataEntitySet } from './entitySet';
type DraftElement = {
    IsActiveEntity: boolean;
    HasDraftEntity: boolean;
    HasActiveEntity: boolean;
    DraftAdministrativeData: DraftAdministrativeData | null;
    Processed: boolean;
};
type DraftAdministrativeData = {
    DraftUUID: string;
    DraftEntityType: string;
    CreationDateTime: string;
    LastChangeDateTime: string;
    CreatedByUser: string;
    LastChangedByUser: string;
    DraftAccessType: string;
    InProcessByUser: string;
    DraftIsKeptByUser: boolean;
    DraftIsCreatedByMe: boolean;
    DraftIsLastChangedByMe: boolean;
    DraftIsProcessedByMe: boolean;
    CreatedByUserDescription: string;
    LastChangedByUserDescription: string;
    InProcessByUserDescription: string;
};
export declare class DraftMockEntitySet extends MockDataEntitySet {
    entitySetDefinition: EntitySet;
    constructor(rootFolder: string, entitySetDefinition: EntitySet | EntityType, dataAccess: DataAccessInterface, generateMockData: boolean, forceNullableValuesToNull: boolean);
    protected checkSpecificProperties(filterExpression: any, mockData: any, allData: FileBasedMockData, odataRequest: ODataRequest): boolean | null;
    checkKeyValue(mockData: any, keyValues: any, keyName: string, property?: Property): boolean;
    private getNavigationPropertyDetails;
    private createInactiveVersionForNavigations;
    draftActivate(keyValues: KeyDefinitions, tenantId: string, odataRequest: ODataRequest): Promise<DraftElement | undefined>;
    private activateInactiveVersionForNavigationProperties;
    draftEdit(keyValues: Record<string, any>, tenantId: string, odataRequest: ODataRequest): Promise<void>;
    draftDiscard(keyValues: Record<string, any>, tenantId: string, odataRequest: ODataRequest, cascadeDiscard?: boolean): Promise<any>;
    executeAction(actionDefinition: Action, actionData: object, odataRequest: ODataRequest, keys: Record<string, any>): Promise<any>;
    performPATCH(keyValues: KeyDefinitions, patchData: object, tenantId: string, odataRequest: ODataRequest, updateParent?: boolean): Promise<any>;
    performPOST(keyValues: KeyDefinitions, postData: any, tenantId: string, odataRequest: ODataRequest, updateParent?: boolean): Promise<any>;
    performDELETE(keyValues: KeyDefinitions, tenantId: string, odataRequest: ODataRequest, updateParent?: boolean): Promise<void>;
}
export {};
//# sourceMappingURL=draftEntitySet.d.ts.map