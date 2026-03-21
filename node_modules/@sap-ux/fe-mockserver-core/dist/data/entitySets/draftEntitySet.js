"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftMockEntitySet = void 0;
const common_1 = require("../common");
const entitySet_1 = require("./entitySet");
class DraftMockEntitySet extends entitySet_1.MockDataEntitySet {
    constructor(rootFolder, entitySetDefinition, dataAccess, generateMockData, forceNullableValuesToNull) {
        super(rootFolder, entitySetDefinition, dataAccess, generateMockData, forceNullableValuesToNull, true, true);
    }
    checkSpecificProperties(filterExpression, mockData, allData, odataRequest) {
        if (filterExpression.identifier === 'DraftAdministrativeData/InProcessByUser') {
            return false;
        }
        else if (filterExpression.identifier === 'SiblingEntity/IsActiveEntity' &&
            filterExpression.literal === 'null') {
            // Ensure that there is not sibling entity which is inactive
            const keys = {};
            this.entityTypeDefinition.keys.forEach((keyDef) => {
                if (keyDef.name !== 'IsActiveEntity') {
                    keys[keyDef.name] = mockData[keyDef.name];
                }
                else {
                    keys[keyDef.name] = false;
                }
            });
            return !allData.hasEntry(keys, odataRequest);
        }
        else {
            return null;
        }
    }
    checkKeyValue(mockData, keyValues, keyName, property) {
        if (keyName === 'IsActiveEntity') {
            // Make sure we check a boolean value
            let booleanKeyValue = keyValues[keyName];
            if (typeof booleanKeyValue === 'string') {
                booleanKeyValue = booleanKeyValue === 'true';
            }
            return mockData[keyName] === booleanKeyValue;
        }
        return super.checkKeyValue(mockData, keyValues, keyName, property);
    }
    async getNavigationPropertyDetails(navPropName, data, tenantId) {
        // For all the draft node data duplicate them
        const navPropDetail = this.entityTypeDefinition.navigationProperties.find((navProp) => navProp.name === navPropName);
        const subKeys = await this.dataAccess.getNavigationPropertyKeys(data, navPropDetail, this.entitySetDefinition.entityType, this.entitySetDefinition, {}, tenantId);
        const navPropEntity = (await this.dataAccess.getMockEntitySet(this.entitySetDefinition.navigationPropertyBinding[navPropName].name));
        return { navPropEntity, subKeys };
    }
    async createInactiveVersionForNavigations(data, tenantId, odataRequest) {
        var _a, _b;
        for (const navPropName in this.entitySetDefinition.navigationPropertyBinding) {
            if (!navPropName.endsWith('SiblingEntity') &&
                ((_b = (_a = this.entitySetDefinition.navigationPropertyBinding[navPropName].annotations) === null || _a === void 0 ? void 0 : _a.Common) === null || _b === void 0 ? void 0 : _b.DraftNode)) {
                // For all the draft node data duplicate them
                const { navPropEntity, subKeys } = await this.getNavigationPropertyDetails(navPropName, data, tenantId);
                if (navPropEntity === null || navPropEntity === void 0 ? void 0 : navPropEntity.draftEdit) {
                    await navPropEntity.draftEdit(subKeys, tenantId, odataRequest);
                }
            }
        }
    }
    async draftActivate(keyValues, tenantId, odataRequest) {
        const currentMockData = this.getMockData(tenantId);
        const dataToDuplicate = await this.performGET(keyValues, true, tenantId, odataRequest, true);
        const deleteKeyValues = Object.assign({}, keyValues);
        deleteKeyValues.IsActiveEntity = true;
        const dataToDelete = await this.performGET(deleteKeyValues, true, tenantId, odataRequest, true);
        for (const draftData of dataToDelete) {
            if (draftData.IsActiveEntity && !draftData.HasDraftEntity && !draftData.Processed) {
                // Draft was deleted
                const activateKeyValues = this.getKeys(draftData);
                await currentMockData.removeEntry(activateKeyValues, odataRequest);
            }
        }
        const dataToClean = [];
        let activeDraft;
        for (const draftData of dataToDuplicate) {
            if (!draftData.IsActiveEntity && !draftData.Processed) {
                draftData.HasDraftEntity = false;
                draftData.Processed = true;
                const activateKeyValues = this.getKeys(draftData);
                dataToClean.push(this.getKeys(draftData));
                activateKeyValues.IsActiveEntity = true;
                activeDraft = Object.assign({}, draftData);
                activeDraft.IsActiveEntity = true;
                activeDraft.HasDraftEntity = false;
                activeDraft.HasActiveEntity = false;
                activeDraft.Processed = true;
                activeDraft.DraftAdministrativeData = null;
                if (!currentMockData.hasEntry(activateKeyValues, odataRequest)) {
                    await currentMockData.addEntry(activeDraft, odataRequest);
                }
                else {
                    await currentMockData.updateEntry(activateKeyValues, activeDraft, activeDraft, odataRequest);
                }
                await this.activateInactiveVersionForNavigationProperties(draftData, tenantId, odataRequest);
            }
        }
        for (const draftKeys of dataToClean) {
            const myDataToClean = await this.performGET(draftKeys, false, tenantId, odataRequest, true);
            if (myDataToClean) {
                delete myDataToClean.Processed;
                await currentMockData.updateEntry(draftKeys, myDataToClean, myDataToClean, odataRequest);
            }
        }
        await this.draftDiscard(keyValues, tenantId, odataRequest, false);
        return activeDraft;
    }
    async activateInactiveVersionForNavigationProperties(draftData, tenantId, odataRequest) {
        var _a, _b;
        for (const navPropName in this.entitySetDefinition.navigationPropertyBinding) {
            if (!navPropName.endsWith('SiblingEntity') &&
                ((_b = (_a = this.entitySetDefinition.navigationPropertyBinding[navPropName].annotations) === null || _a === void 0 ? void 0 : _a.Common) === null || _b === void 0 ? void 0 : _b.DraftNode)) {
                // For all the draft node data duplicate them
                const { navPropEntity, subKeys } = await this.getNavigationPropertyDetails(navPropName, draftData, tenantId);
                if (navPropEntity === null || navPropEntity === void 0 ? void 0 : navPropEntity.draftActivate) {
                    await navPropEntity.draftActivate(subKeys, tenantId, odataRequest);
                }
            }
        }
    }
    async draftEdit(keyValues, tenantId, odataRequest) {
        const currentMockData = this.getMockData(tenantId);
        const dataToDuplicate = await this.performGET(keyValues, true, tenantId, odataRequest, true);
        for (const data of dataToDuplicate) {
            if (!data.HasDraftEntity && data.IsActiveEntity) {
                data.HasDraftEntity = true;
                data.Processed = false;
                const duplicate = Object.assign({}, data);
                duplicate.IsActiveEntity = false;
                duplicate.HasActiveEntity = true;
                duplicate.Processed = false;
                duplicate.HasDraftEntity = false;
                const currentDate = (0, common_1._getDateTimeOffset)(this.isV4());
                duplicate.DraftAdministrativeData = {
                    DraftUUID: (0, common_1.uuidv4)(),
                    DraftEntityType: this.entityTypeDefinition.fullyQualifiedName,
                    CreationDateTime: currentDate,
                    CreatedByUser: 'nobody',
                    LastChangeDateTime: currentDate,
                    LastChangedByUser: 'nobody',
                    DraftAccessType: '',
                    InProcessByUser: 'nobody',
                    DraftIsKeptByUser: false,
                    DraftIsCreatedByMe: true,
                    DraftIsLastChangedByMe: true,
                    DraftIsProcessedByMe: true,
                    CreatedByUserDescription: 'nobody',
                    LastChangedByUserDescription: 'nobody',
                    InProcessByUserDescription: 'nobody'
                };
                await currentMockData.addEntry(duplicate, odataRequest);
                await this.createInactiveVersionForNavigations(data, tenantId, odataRequest);
            }
        }
    }
    async draftDiscard(keyValues, tenantId, odataRequest, cascadeDiscard = true) {
        var _a, _b;
        const dataToDiscard = await this.performGET(keyValues, true, tenantId, odataRequest);
        for (const data of dataToDiscard) {
            const keys = this.getKeys(data);
            await super.performDELETE(keys, tenantId, odataRequest);
            if (cascadeDiscard) {
                for (const navPropName in this.entitySetDefinition.navigationPropertyBinding) {
                    if (!navPropName.endsWith('SiblingEntity') &&
                        ((_b = (_a = this.entitySetDefinition.navigationPropertyBinding[navPropName].annotations) === null || _a === void 0 ? void 0 : _a.Common) === null || _b === void 0 ? void 0 : _b.DraftNode)) {
                        // For all the draft node data duplicate them
                        const { navPropEntity, subKeys } = await this.getNavigationPropertyDetails(navPropName, data, tenantId);
                        if (navPropEntity === null || navPropEntity === void 0 ? void 0 : navPropEntity.draftDiscard) {
                            await navPropEntity.draftDiscard(subKeys, tenantId, odataRequest);
                        }
                    }
                }
            }
            const deleteKeyValues = Object.assign({}, keys);
            deleteKeyValues.IsActiveEntity = true;
            const newActiveData = (await this.performGET(deleteKeyValues, false, tenantId, odataRequest, true));
            if (newActiveData) {
                newActiveData.HasDraftEntity = false;
            }
        }
        const activeVersionOfDeletedKeys = Object.assign({}, keyValues);
        activeVersionOfDeletedKeys.IsActiveEntity = true;
        const dataToAdjust = await this.performGET(activeVersionOfDeletedKeys, true, tenantId, odataRequest, true);
        let activeData;
        for (const data of dataToAdjust) {
            data.HasDraftEntity = false;
            activeData = data;
        }
        return activeData;
    }
    async executeAction(actionDefinition, actionData, odataRequest, keys) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        const currentMockData = this.getMockData(odataRequest.tenantId);
        actionData = await currentMockData.onBeforeAction(actionDefinition, actionData, keys, odataRequest);
        let responseObject;
        switch (actionDefinition.fullyQualifiedName) {
            // Draft Edit Action
            case `${(_b = (_a = this.entitySetDefinition.annotations.Common) === null || _a === void 0 ? void 0 : _a.DraftRoot) === null || _b === void 0 ? void 0 : _b.EditAction}(${this.entitySetDefinition.entityTypeName})`:
            case `${(_d = (_c = this.entitySetDefinition.annotations.Common) === null || _c === void 0 ? void 0 : _c.DraftRoot) === null || _d === void 0 ? void 0 : _d.EditAction}()`: {
                await this.draftEdit(keys, odataRequest.tenantId, odataRequest);
                odataRequest.queryPath.pop();
                odataRequest.queryPath[odataRequest.queryPath.length - 1].keys = Object.assign({}, keys, {
                    IsActiveEntity: false
                });
                responseObject = this.dataAccess.getData(odataRequest);
                break;
            }
            case `${(_f = (_e = this.entitySetDefinition.annotations.Common) === null || _e === void 0 ? void 0 : _e.DraftRoot) === null || _f === void 0 ? void 0 : _f.PreparationAction}(${this.entitySetDefinition.entityTypeName})`:
            case `${(_h = (_g = this.entitySetDefinition.annotations.Common) === null || _g === void 0 ? void 0 : _g.DraftRoot) === null || _h === void 0 ? void 0 : _h.PreparationAction}()`:
                // Prepare
                responseObject = await this.performGET(keys, false, odataRequest.tenantId, odataRequest);
                await currentMockData.onDraftPrepare(actionDefinition, responseObject, keys, odataRequest);
                break;
            case `${(_k = (_j = this.entitySetDefinition.annotations.Common) === null || _j === void 0 ? void 0 : _j.DraftRoot) === null || _k === void 0 ? void 0 : _k.DiscardAction}(${this.entitySetDefinition.entityTypeName})`:
            case `${(_m = (_l = this.entitySetDefinition.annotations.Common) === null || _l === void 0 ? void 0 : _l.DraftRoot) === null || _m === void 0 ? void 0 : _m.DiscardAction}()`: {
                // Discard
                responseObject = await this.draftDiscard(keys, odataRequest.tenantId, odataRequest);
                break;
            }
            case `${(_p = (_o = this.entitySetDefinition.annotations.Common) === null || _o === void 0 ? void 0 : _o.DraftRoot) === null || _p === void 0 ? void 0 : _p.ActivationAction}(${this.entitySetDefinition.entityTypeName})`:
            case `${(_r = (_q = this.entitySetDefinition.annotations.Common) === null || _q === void 0 ? void 0 : _q.DraftRoot) === null || _r === void 0 ? void 0 : _r.ActivationAction}()`: {
                await this.draftActivate(keys, odataRequest.tenantId, odataRequest);
                odataRequest.queryPath.pop();
                odataRequest.queryPath[odataRequest.queryPath.length - 1].keys = Object.assign({}, keys, {
                    IsActiveEntity: true
                });
                responseObject = await this.dataAccess.getData(odataRequest);
                delete responseObject.Processed;
                break;
            }
            default:
                responseObject = await currentMockData.executeAction(actionDefinition, actionData, keys, odataRequest);
                break;
        }
        responseObject = await currentMockData.onAfterAction(actionDefinition, actionData, keys, responseObject, odataRequest);
        return responseObject;
    }
    async performPATCH(keyValues, patchData, tenantId, odataRequest, updateParent = false) {
        var _a, _b, _c, _d, _e, _f;
        const updatedData = await super.performPATCH(keyValues, patchData, tenantId, odataRequest);
        if (updateParent && ((_c = (_b = (_a = this.entitySetDefinition) === null || _a === void 0 ? void 0 : _a.annotations) === null || _b === void 0 ? void 0 : _b.Common) === null || _c === void 0 ? void 0 : _c.DraftNode)) {
            const parentEntity = await this.dataAccess.getDraftRoot(keyValues, tenantId, this.entitySetDefinition);
            if ((parentEntity === null || parentEntity === void 0 ? void 0 : parentEntity.DraftAdministrativeData) !== null && (parentEntity === null || parentEntity === void 0 ? void 0 : parentEntity.DraftAdministrativeData) !== undefined) {
                parentEntity.DraftAdministrativeData.LastChangeDateTime = (0, common_1._getDateTimeOffset)(this.isV4());
            }
        }
        if ((_f = (_e = (_d = this.entitySetDefinition) === null || _d === void 0 ? void 0 : _d.annotations) === null || _e === void 0 ? void 0 : _e.Common) === null || _f === void 0 ? void 0 : _f.DraftRoot) {
            const myDataToUpdate = await this.performGET(keyValues, false, tenantId, odataRequest, true);
            if (myDataToUpdate === null || myDataToUpdate === void 0 ? void 0 : myDataToUpdate.DraftAdministrativeData) {
                myDataToUpdate.DraftAdministrativeData.LastChangeDateTime = (0, common_1._getDateTimeOffset)(this.isV4());
            }
        }
        return updatedData;
    }
    async performPOST(keyValues, postData, tenantId, odataRequest, updateParent = false) {
        var _a, _b, _c, _d;
        if (updateParent && ((_c = (_b = (_a = this.entitySetDefinition) === null || _a === void 0 ? void 0 : _a.annotations) === null || _b === void 0 ? void 0 : _b.Common) === null || _c === void 0 ? void 0 : _c.DraftNode)) {
            const parentEntity = await this.dataAccess.getDraftRoot(keyValues, tenantId, this.entitySetDefinition);
            if ((parentEntity === null || parentEntity === void 0 ? void 0 : parentEntity.DraftAdministrativeData) !== null && (parentEntity === null || parentEntity === void 0 ? void 0 : parentEntity.DraftAdministrativeData) !== undefined) {
                parentEntity.DraftAdministrativeData.LastChangeDateTime = (0, common_1._getDateTimeOffset)(this.isV4());
            }
        }
        // Validate potentially missing keys
        if (!Object.hasOwnProperty.call(postData, 'IsActiveEntity')) {
            postData.IsActiveEntity = false;
        }
        if (!Object.hasOwnProperty.call(postData, 'HasActiveEntity')) {
            postData.HasActiveEntity = false;
        }
        if (!Object.hasOwnProperty.call(postData, 'HasDraftEntity')) {
            postData.HasDraftEntity = false; // HasDraftEntity should be false during the create phase
        }
        const currentDate = (0, common_1._getDateTimeOffset)(this.isV4());
        postData.DraftAdministrativeData = {
            DraftUUID: (_d = postData.DraftUUID) !== null && _d !== void 0 ? _d : (0, common_1.uuidv4)(),
            DraftEntityType: this.entityTypeDefinition.fullyQualifiedName,
            CreationDateTime: currentDate,
            CreatedByUser: 'nobody',
            LastChangeDateTime: currentDate,
            LastChangedByUser: 'nobody',
            DraftAccessType: '',
            InProcessByUser: 'nobody',
            DraftIsKeptByUser: false,
            DraftIsCreatedByMe: true,
            DraftIsLastChangedByMe: true,
            DraftIsProcessedByMe: true,
            CreatedByUserDescription: 'nobody',
            LastChangedByUserDescription: 'nobody',
            InProcessByUserDescription: 'nobody'
        };
        return super.performPOST(keyValues, postData, tenantId, odataRequest);
    }
    async performDELETE(keyValues, tenantId, odataRequest, updateParent = false) {
        var _a, _b, _c, _d, _e, _f, _g;
        const draftData = await this.performGET(keyValues, false, tenantId, odataRequest);
        if (updateParent && ((_c = (_b = (_a = this.entitySetDefinition) === null || _a === void 0 ? void 0 : _a.annotations) === null || _b === void 0 ? void 0 : _b.Common) === null || _c === void 0 ? void 0 : _c.DraftNode)) {
            const parentEntity = await this.dataAccess.getDraftRoot(keyValues, tenantId, this.entitySetDefinition);
            if ((parentEntity === null || parentEntity === void 0 ? void 0 : parentEntity.DraftAdministrativeData) !== null && (parentEntity === null || parentEntity === void 0 ? void 0 : parentEntity.DraftAdministrativeData) !== undefined) {
                parentEntity.DraftAdministrativeData.LastChangeDateTime = (0, common_1._getDateTimeOffset)(this.isV4());
            }
        }
        if (((_e = (_d = this.entitySetDefinition.annotations) === null || _d === void 0 ? void 0 : _d.Common) === null || _e === void 0 ? void 0 : _e.DraftRoot) && draftData && !draftData.IsActiveEntity) {
            await this.draftDiscard(keyValues, tenantId, odataRequest);
        }
        else {
            if (((_g = (_f = this.entitySetDefinition.annotations) === null || _f === void 0 ? void 0 : _f.Common) === null || _g === void 0 ? void 0 : _g.DraftNode) && draftData && !draftData.IsActiveEntity) {
                // Update the sibling
                const activeKeys = Object.assign({}, keyValues, { IsActiveEntity: true });
                const activeEquivalent = await this.performGET(activeKeys, false, tenantId, odataRequest, true);
                if (activeEquivalent === null || activeEquivalent === void 0 ? void 0 : activeEquivalent.HasDraftEntity) {
                    activeEquivalent.HasDraftEntity = false;
                }
            }
            return super.performDELETE(keyValues, tenantId, odataRequest);
        }
    }
}
exports.DraftMockEntitySet = DraftMockEntitySet;
//# sourceMappingURL=draftEntitySet.js.map