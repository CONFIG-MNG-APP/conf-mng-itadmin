import type { Action, EntitySet, EntityType } from '@sap-ux/vocabularies-types';
import type ODataRequest from '../../request/odataRequest';
import type { KeyDefinitions } from '../../request/odataRequest';
import type { IncomingMessageWithTenant } from '../../router/serviceRouter';
import type { DataAccessInterface } from '../common';
import { MockDataEntitySet } from './entitySet';
declare class Session {
    private readonly contextId;
    private data;
    private readonly sessionTimeout;
    private readonly discardSession;
    private timeoutId;
    constructor(contextId: string, data: any, sessionTimeout: number, discardSession: () => void);
    resetTimeout(): void;
    addSessionToken(odataRequest: ODataRequest): void;
    setData(data: any): void;
    getData(): any;
    discard(odataRequest?: ODataRequest): void;
}
/**
 *
 */
export declare class StickyMockEntitySet extends MockDataEntitySet {
    private readonly sessions;
    private readonly discardAction;
    constructor(rootFolder: string, entitySetDefinition: EntitySet | EntityType, dataAccess: DataAccessInterface, generateMockData: boolean, forceNullableValuesToNull: boolean);
    createSession(data?: any, sessionTimeout?: number): Session;
    getSession(request: ODataRequest | IncomingMessageWithTenant): Session | undefined;
    performPATCH(keyValues: KeyDefinitions, patchData: object, tenantId: string, odataRequest: ODataRequest): Promise<any>;
    executeAction(actionDefinition: Action, actionData: object | undefined, odataRequest: ODataRequest, keys: Record<string, any>): Promise<any>;
    performGET(keyValues: KeyDefinitions, asArray: boolean, tenantId: string, odataRequest: ODataRequest, dontClone?: boolean): Promise<any>;
    isDiscardAction(action: Action): boolean;
}
export {};
//# sourceMappingURL=stickyEntitySet.d.ts.map