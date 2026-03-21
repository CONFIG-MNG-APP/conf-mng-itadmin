import type { ServerConfig } from '@sap-ux/fe-mockserver-core';
import type { IRouter } from 'router';
export type { Action, KeyDefinitions, MockDataContributor, MockEntityContainerContributor, NavigationProperty, ODataRequest, PartialReferentialConstraint, ServiceRegistry } from '@sap-ux/fe-mockserver-core';
declare function FEMiddleware(middlewareConfig: {
    resources?: any;
    options: {
        configuration: ServerConfig;
    };
}): Promise<IRouter>;
declare namespace FEMiddleware {
    var MockDataContributorClass: typeof import("@sap-ux/fe-mockserver-core").MockDataContributorClass;
    var MockEntityContainerContributorClass: typeof import("@sap-ux/fe-mockserver-core").MockEntityContainerContributorClass;
}
export = FEMiddleware;
//# sourceMappingURL=index.d.ts.map