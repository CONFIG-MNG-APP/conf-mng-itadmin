import type { EntitySet, EntityType } from '@sap-ux/vocabularies-types';
import type { DataAccessInterface } from '../common';
import { MockDataEntitySet } from './entitySet';
export declare class ContainedDataEntitySet extends MockDataEntitySet {
    constructor(entitySetDefinition: EntitySet | EntityType, containedData: any, dataAccess: DataAccessInterface);
}
//# sourceMappingURL=ContainedDataEntitySet.d.ts.map