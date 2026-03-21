import type { Action, ActionImport, ConvertedMetadata, EntitySet, EntityType, NavigationProperty, RawMetadata, Singleton } from '@sap-ux/vocabularies-types';
type NameAndNav = {
    name: string;
    entitySet: EntitySet | Singleton;
    navigation: NavigationProperty;
    partner?: NavigationProperty;
};
/**
 *
 */
export declare class ODataMetadata {
    private edmx;
    static parse(edmx: string, metadataUrl: string, ETag?: string): Promise<ODataMetadata>;
    getEdmx(): string;
    getMetadataUrl(): string;
    readonly typeToEntityMapping: object;
    readonly ETag: string | undefined;
    readonly metadataUrl: string;
    protected readonly metadata: ConvertedMetadata;
    protected readonly parserMetadata: RawMetadata;
    private constructor();
    getVersion(): string;
    getEntitySet(entitySetName: string): EntitySet | undefined;
    getSingleton(singletonName: string): EntitySet;
    getEntitySets(): EntitySet[];
    getSingletons(): Singleton[];
    getEntityType(entityTypeName: string): EntityType | undefined;
    getEntitySetByType(entityTypeName: string): EntitySet | undefined;
    getActionByFQN(actionFQN: string): Action | undefined;
    getActionImportByFQN(actionImportFQN: string): ActionImport | undefined;
    getEntityContainerPath(): string;
    isDraftEntity(entitySet: EntitySet): boolean;
    isStickyEntity(entitySet: EntitySet): boolean;
    isDraftRoot(entitySet: EntitySet): boolean;
    isDraftNode(entitySet: EntitySet | Singleton): boolean;
    resolvePath(path: string): any;
    findInDescendant(entitySet: EntitySet | Singleton, targetEntitySet: EntitySet, path: NameAndNav[], entitySetFilter?: (entitySet: EntitySet | Singleton) => boolean): boolean;
    resolveDraftRoot(entitySet: EntitySet): {
        found: boolean;
        entitySet: EntitySet;
        path: NameAndNav[];
    } | {
        found: boolean;
        entitySet: undefined;
        path: never[];
    };
    resolveAncestors(entitySet: EntitySet): {
        found: boolean;
        entitySet: EntitySet;
        path: NameAndNav[];
    };
    getParentEntitySetName(sourceEntitySet: EntitySet): string | undefined;
    getETag(): string | undefined;
    getKeys(dataLine: any, entityType: EntityType): Record<string, string | number | boolean>;
    getExternalServices(metadataPath: string): {
        rootPath: string;
        externalServiceMetadataPath: string;
        localPath: string;
        dataPath: string;
    }[];
}
export {};
//# sourceMappingURL=metadata.d.ts.map