"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ODataMetadata = void 0;
const annotation_converter_1 = require("@sap-ux/annotation-converter");
const edmx_parser_1 = require("@sap-ux/edmx-parser");
const path_1 = require("path");
const posix_1 = require("path/posix");
/**
 *
 */
class ODataMetadata {
    static async parse(edmx, metadataUrl, ETag) {
        const metadata = (0, edmx_parser_1.parse)(edmx);
        const converterMetadata = (0, annotation_converter_1.convert)(metadata);
        return new ODataMetadata(converterMetadata, metadata, metadataUrl, edmx, ETag);
    }
    getEdmx() {
        return this.edmx;
    }
    getMetadataUrl() {
        return this.metadataUrl;
    }
    constructor(metadata, parserMetadata, metadataUrl, edmx, ETag) {
        this.edmx = edmx;
        this.typeToEntityMapping = {};
        this.metadata = metadata;
        this.parserMetadata = parserMetadata;
        this.metadataUrl = metadataUrl;
        this.ETag = ETag;
    }
    getVersion() {
        return this.metadata.version === '1.0' ? '2.0' : '4.0';
    }
    getEntitySet(entitySetName) {
        return this.metadata.entitySets.find((entitySet) => entitySet.name === entitySetName);
    }
    getSingleton(singletonName) {
        return this.metadata.singletons.find((singleton) => singleton.name === singletonName);
    }
    getEntitySets() {
        return this.metadata.entitySets;
    }
    getSingletons() {
        return this.metadata.singletons || [];
    }
    getEntityType(entityTypeName) {
        return this.metadata.entityTypes.find((entityType) => entityType.name === entityTypeName);
    }
    getEntitySetByType(entityTypeName) {
        return this.metadata.entitySets.find((entitySet) => entitySet.entityTypeName === entityTypeName);
    }
    getActionByFQN(actionFQN) {
        let action = this.metadata.actions.find((action) => action.fullyQualifiedName === actionFQN);
        if (!action) {
            const unaliasedAction = (0, annotation_converter_1.unalias)(this.metadata.references, actionFQN, this.metadata.namespace);
            action = this.metadata.actions.find((action) => action.fullyQualifiedName === unaliasedAction);
        }
        return action;
    }
    getActionImportByFQN(actionImportFQN) {
        return this.metadata.actionImports.find((actionImport) => actionImport.fullyQualifiedName === actionImportFQN);
    }
    getEntityContainerPath() {
        return this.parserMetadata.schema.entityContainer.fullyQualifiedName;
    }
    isDraftEntity(entitySet) {
        var _a, _b, _c, _d;
        return (((_b = (_a = entitySet === null || entitySet === void 0 ? void 0 : entitySet.annotations) === null || _a === void 0 ? void 0 : _a.Common) === null || _b === void 0 ? void 0 : _b.DraftRoot) !== undefined ||
            ((_d = (_c = entitySet === null || entitySet === void 0 ? void 0 : entitySet.annotations) === null || _c === void 0 ? void 0 : _c.Common) === null || _d === void 0 ? void 0 : _d.DraftNode) !== undefined);
    }
    isStickyEntity(entitySet) {
        var _a, _b;
        return ((_b = (_a = entitySet === null || entitySet === void 0 ? void 0 : entitySet.annotations) === null || _a === void 0 ? void 0 : _a.Session) === null || _b === void 0 ? void 0 : _b.StickySessionSupported) !== undefined;
    }
    isDraftRoot(entitySet) {
        var _a, _b;
        return ((_b = (_a = entitySet === null || entitySet === void 0 ? void 0 : entitySet.annotations) === null || _a === void 0 ? void 0 : _a.Common) === null || _b === void 0 ? void 0 : _b.DraftRoot) !== undefined;
    }
    isDraftNode(entitySet) {
        var _a;
        return entitySet._type === 'EntitySet' && ((_a = entitySet.annotations.Common) === null || _a === void 0 ? void 0 : _a.DraftNode) !== undefined;
    }
    resolvePath(path) {
        return this.metadata.resolvePath(path);
    }
    findInDescendant(entitySet, targetEntitySet, path, entitySetFilter = () => true) {
        if (entitySet === targetEntitySet) {
            // nothing to do - we are there already
            return true;
        }
        const pathLength = path.length;
        for (const [navPropBindingName, target] of Object.entries(entitySet.navigationPropertyBinding)) {
            if (!entitySetFilter(target)) {
                continue;
            }
            const navProp = entitySet.entityType.navigationProperties.find((navigationProperty) => navigationProperty.name === navPropBindingName);
            if (path.some((segment) => segment.entitySet === target)) {
                // would add a cycle
                return false;
            }
            else if (navProp) {
                const partnerNavProp = navProp.targetType.navigationProperties.find((navigationProperty) => navigationProperty.name === navProp.partner);
                path.push({
                    name: navPropBindingName,
                    entitySet: target,
                    navigation: navProp,
                    partner: partnerNavProp
                });
            }
            if (target === targetEntitySet) {
                return true;
            }
            else {
                const wasFound = this.findInDescendant(target, targetEntitySet, path, entitySetFilter);
                if (!wasFound) {
                    // Let's try another path sp we reset to what we had before
                    path.splice(pathLength);
                }
                else {
                    return true;
                }
            }
        }
        return false;
    }
    resolveDraftRoot(entitySet) {
        if (this.isDraftEntity(entitySet)) {
            // entity set must be a draft node, otherwise there is no point in looking for its root
            const draftRoots = this.metadata.entitySets.filter(this.isDraftRoot);
            for (const draftRoot of draftRoots) {
                const path = [];
                const found = this.findInDescendant(draftRoot, entitySet, path, this.isDraftNode);
                if (found) {
                    return {
                        found: true,
                        entitySet: draftRoot,
                        path: path
                    };
                }
            }
        }
        return { found: false, entitySet: undefined, path: [] };
    }
    resolveAncestors(entitySet) {
        let found = false;
        let foundPath;
        let rootEntitySet;
        this.metadata.entitySets.forEach((et) => {
            if (!found && et !== entitySet) {
                const resolvePath = [];
                found = this.findInDescendant(et, entitySet, resolvePath);
                if (found) {
                    foundPath = resolvePath.concat();
                    rootEntitySet = et;
                }
            }
        });
        return {
            found,
            entitySet: rootEntitySet,
            path: foundPath
        };
    }
    getParentEntitySetName(sourceEntitySet) {
        const { found, path, entitySet } = this.resolveAncestors(sourceEntitySet);
        if (found) {
            if (path.length === 1 && entitySet) {
                return entitySet.name;
            }
            else {
                return path[path.length - 1].entitySet.name;
            }
        }
    }
    getETag() {
        return this.ETag;
    }
    getKeys(dataLine, entityType) {
        const keys = entityType.keys;
        const keyValues = {};
        keys.forEach((keyProp) => {
            keyValues[keyProp.name] = dataLine[keyProp.name];
        });
        return keyValues;
    }
    getExternalServices(metadataPath) {
        var _a, _b, _c, _d;
        const uris = new Set();
        const references = [];
        const rootPath = this.metadataUrl.replace('/$metadata', '');
        for (const entityType of this.metadata.entityTypes) {
            for (const property of entityType.entityProperties) {
                const target = `${entityType.name}/${property.name}`;
                for (const reference of (_b = (_a = property.annotations.Common) === null || _a === void 0 ? void 0 : _a.ValueListReferences) !== null && _b !== void 0 ? _b : []) {
                    const externalServicePath = (0, posix_1.join)(rootPath, reference).replace('/$metadata', '');
                    const serviceRoot = getServiceRoot(metadataPath, externalServicePath, rootPath);
                    const localPath = (0, path_1.join)(serviceRoot, target, `metadata.xml`);
                    if (uris.has(externalServicePath)) {
                        continue;
                    }
                    uris.add(externalServicePath);
                    references.push({
                        rootPath,
                        externalServiceMetadataPath: externalServicePath,
                        localPath: localPath,
                        dataPath: serviceRoot
                    });
                }
            }
        }
        const codeLists = [
            (_c = this.metadata.entityContainer.annotations.CodeList) === null || _c === void 0 ? void 0 : _c.CurrencyCodes,
            (_d = this.metadata.entityContainer.annotations.CodeList) === null || _d === void 0 ? void 0 : _d.UnitsOfMeasure
        ];
        for (const annotation of codeLists) {
            if (!annotation) {
                continue;
            }
            const externalServicePath = (0, posix_1.join)(rootPath, annotation.Url.toString()).replace('/$metadata', '');
            if (uris.has(externalServicePath)) {
                continue;
            }
            uris.add(externalServicePath);
            const serviceRoot = getServiceRoot(metadataPath, externalServicePath, rootPath);
            const localPath = (0, path_1.join)(serviceRoot, `metadata.xml`);
            references.push({
                rootPath,
                externalServiceMetadataPath: externalServicePath,
                localPath: localPath,
                dataPath: serviceRoot
            });
        }
        return references;
    }
}
exports.ODataMetadata = ODataMetadata;
function getServiceRoot(metadataPath, pathWithParameters, rootPath) {
    const [relativePath] = pathWithParameters.split(';');
    const segments = relativePath.split('/');
    let prefix = '/';
    let currentSegment = segments.shift();
    while (currentSegment !== undefined) {
        const next = (0, posix_1.join)(prefix, currentSegment);
        if (!rootPath.startsWith(next)) {
            break;
        }
        prefix = next;
        currentSegment = segments.shift();
    }
    const relativeServicePath = relativePath.replace(prefix, '');
    return (0, path_1.join)(metadataPath, '..', relativeServicePath);
}
//# sourceMappingURL=metadata.js.map