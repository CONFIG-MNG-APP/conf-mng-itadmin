/// <reference path="../types.d.ts" />
import type { MockserverConfiguration } from './api';
import { ServiceRegistry } from './data/serviceRegistry';
import ODataRequest from './request/odataRequest';
export type { Action, NavigationProperty } from '@sap-ux/vocabularies-types';
export * from './api';
export type { PartialReferentialConstraint } from './data/common';
export { ServiceRegistry } from './data/serviceRegistry';
export { MockDataContributorClass, MockEntityContainerContributorClass } from './mockdata/baseContributor';
export { MockDataContributor } from './mockdata/functionBasedMockData';
export { MockEntityContainerContributor } from './mockdata/mockEntityContainer';
export { KeyDefinitions } from './request/odataRequest';
export { ODataRequest };
export default class FEMockserver {
    private configuration;
    isReady: Promise<void>;
    private fileLoader;
    private metadataProvider;
    private readonly mainRouter;
    private serviceRegistry;
    private plugins;
    constructor(configuration: MockserverConfiguration);
    private initialize;
    getServiceRegistry(): ServiceRegistry;
    getRouter(): import("router").Router.IRouter;
    dispose(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map