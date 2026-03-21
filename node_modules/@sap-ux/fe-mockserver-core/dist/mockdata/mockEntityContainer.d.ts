import type { Action } from '@sap-ux/vocabularies-types';
import type { DataAccessInterface } from '../data/common';
import type { IFileLoader } from '../index';
import type ODataRequest from '../request/odataRequest';
import type { FileBasedMockData } from './fileBasedMockData';
export type MockEntityContainerBase = {
    getEntityInterface: (entityName: string, aliasOrService?: string) => Promise<FileBasedMockData | undefined>;
};
export type MockEntityContainerContributor = {
    executeAction?(actionDefinition: Action, actionData: any, keys: Record<string, any>, odataRequest: ODataRequest): Promise<unknown>;
    handleRequest?(odataRequest: ODataRequest): Promise<unknown>;
    throwError?(message: string, statusCode?: number, messageData?: object): any;
    base?: MockEntityContainerBase;
};
export declare class MockEntityContainer {
    static read(mockDataRootFolder: string, tenantId: string, fileLoader: IFileLoader, dataAccess: DataAccessInterface): Promise<MockEntityContainerContributor>;
}
//# sourceMappingURL=mockEntityContainer.d.ts.map