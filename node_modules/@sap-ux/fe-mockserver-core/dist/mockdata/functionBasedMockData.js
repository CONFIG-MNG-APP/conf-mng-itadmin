"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionBasedMockData = void 0;
const common_1 = require("../data/common");
const fileBasedMockData_1 = require("./fileBasedMockData");
/**
 *
 */
class FunctionBasedMockData extends fileBasedMockData_1.FileBasedMockData {
    constructor(mockDataFn, entityType, mockDataEntitySet, contextId) {
        const noMock = [];
        noMock.__generateMockData = true;
        super(((mockDataFn === null || mockDataFn === void 0 ? void 0 : mockDataFn.getInitialDataSet) ? mockDataFn.getInitialDataSet(contextId) : noMock) || noMock, entityType, mockDataEntitySet, contextId);
        this._mockDataFn = mockDataFn;
        // Helper function to create a partial updateEntry that fetches existing data and merges with patch
        const createPartialUpdateEntry = (fetchEntries, updateEntry) => {
            return async (keyValues, patchData, odataRequest = {}) => {
                const data = (await fetchEntries(keyValues, odataRequest))[0];
                const updatedData = Object.assign(data, patchData);
                return updateEntry(keyValues, updatedData, patchData, odataRequest);
            };
        };
        // Helper function to create an addEntry that automatically generates keys and handles draft entities
        const createAutoKeyAddEntry = (entityType, generateKey, getEmptyObject, addEntry) => {
            return (postData) => {
                entityType.keys.forEach((keyProp) => {
                    if (postData[keyProp.name] === undefined || postData[keyProp.name].length === 0) {
                        // Missing key
                        if (keyProp.name === 'IsActiveEntity') {
                            postData['IsActiveEntity'] = false;
                        }
                        else {
                            postData[keyProp.name] = generateKey(keyProp);
                        }
                    }
                });
                let newObject = getEmptyObject({});
                newObject = Object.assign(newObject, postData);
                return addEntry(newObject, {});
            };
        };
        this._mockDataFn.base = {
            generateMockData: super.generateMockData.bind(this),
            generateKey: super.generateKey.bind(this),
            addEntry: createAutoKeyAddEntry(this._entityType, super.generateKey.bind(this), super.getEmptyObject.bind(this), super.addEntry.bind(this)),
            updateEntry: createPartialUpdateEntry(this.fetchEntries.bind(this), super.updateEntry.bind(this)),
            removeEntry: super.removeEntry.bind(this),
            fetchEntries: super.fetchEntries.bind(this),
            hasEntry: super.hasEntry.bind(this),
            hasEntries: super.hasEntries.bind(this),
            getAllEntries: super.getAllEntries.bind(this),
            getEmptyObject: super.getEmptyObject.bind(this),
            getDefaultElement: super.getDefaultElement.bind(this),
            getParentEntityInterface: super.getParentEntityInterface.bind(this),
            getServiceRegistry: super.getServiceRegistry.bind(this),
            getEntityInterface: async (entitySetName, serviceNameOrAlias) => {
                const rawInterface = await super.getEntityInterface.call(this, entitySetName, serviceNameOrAlias);
                if (!rawInterface) {
                    return rawInterface;
                }
                // If this is a cross-service call, enhance with auto-key and partial update behavior
                if (serviceNameOrAlias) {
                    // Enhance the interface with both addEntry and updateEntry behavior using the same helpers
                    const enhancedInterface = Object.create(rawInterface);
                    // Add auto-key generation for addEntry - access _entityType via type assertion
                    // since we know cross-service interfaces return FileBasedMockData instances
                    const fileBasedInterface = rawInterface;
                    if (fileBasedInterface._entityType) {
                        enhancedInterface.addEntry = createAutoKeyAddEntry(fileBasedInterface._entityType, rawInterface.generateKey.bind(rawInterface), rawInterface.getEmptyObject.bind(rawInterface), rawInterface.addEntry.bind(rawInterface));
                    }
                    // Add partial update behavior for updateEntry
                    enhancedInterface.updateEntry = createPartialUpdateEntry(rawInterface.fetchEntries.bind(rawInterface), rawInterface.updateEntry.bind(rawInterface));
                    return enhancedInterface;
                }
                // Return the raw interface for same-service calls
                return rawInterface;
            },
            onDraftPrepare: super.onDraftPrepare.bind(this),
            checkFilterValue: super.checkFilterValue.bind(this),
            checkSearchQuery: super.checkSearchQuery.bind(this)
        };
        this._mockDataFn.throwError = function (message, statusCode = 500, messageData, isSAPMessage = false, headers = {}, isGlobalRequestError) {
            throw new common_1.ExecutionError(message, statusCode, messageData, isSAPMessage, headers, isGlobalRequestError);
        };
    }
    async addEntry(mockEntry, odataRequest) {
        if (this._mockDataFn.addEntry) {
            return this._mockDataFn.addEntry(mockEntry, odataRequest);
        }
        return super.addEntry(mockEntry, odataRequest);
    }
    async updateEntry(keyValues, updatedData, patchData, odataRequest) {
        if (this._mockDataFn.updateEntry) {
            return this._mockDataFn.updateEntry(keyValues, updatedData, patchData, odataRequest);
        }
        return super.updateEntry(keyValues, updatedData, patchData, odataRequest);
    }
    async removeEntry(keyValues, odataRequest) {
        if (this._mockDataFn.removeEntry) {
            return this._mockDataFn.removeEntry(keyValues, odataRequest);
        }
        return super.removeEntry(keyValues, odataRequest);
    }
    async fetchEntries(keyValues, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.fetchEntries) {
            return this._mockDataFn.fetchEntries(keyValues, odataRequest);
        }
        else {
            return super.fetchEntries(keyValues, odataRequest);
        }
    }
    hasEntry(keyValues, odataRequest) {
        if (this._mockDataFn.hasEntry) {
            return this._mockDataFn.hasEntry(keyValues, odataRequest);
        }
        return super.hasEntry(keyValues, odataRequest);
    }
    hasEntries(odataRequest) {
        if (this._mockDataFn.hasEntries) {
            return this._mockDataFn.hasEntries(odataRequest);
        }
        return super.hasEntries(odataRequest);
    }
    getEmptyObject(odataRequest, allowEmptyKeys = false) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.getEmptyObject) {
            return this._mockDataFn.getEmptyObject(odataRequest);
        }
        else {
            return super.getEmptyObject(odataRequest, allowEmptyKeys);
        }
    }
    getDefaultElement(odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.getDefaultElement) {
            return this._mockDataFn.getDefaultElement(odataRequest);
        }
        else {
            return super.getDefaultElement(odataRequest);
        }
    }
    generateKey(property, lineIndex, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.generateKey) {
            return this._mockDataFn.generateKey(property, lineIndex, odataRequest);
        }
        else {
            return super.generateKey(property, lineIndex, odataRequest);
        }
    }
    async getAllEntries(odataRequest, dontClone = false) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.getAllEntries) {
            return this._mockDataFn.getAllEntries(odataRequest);
        }
        else {
            return super.getAllEntries(odataRequest, dontClone);
        }
    }
    async onBeforeAction(actionDefinition, actionData, keys, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.onBeforeAction) {
            return this._mockDataFn.onBeforeAction(actionDefinition, actionData, keys, odataRequest);
        }
        else {
            return super.onBeforeAction(actionDefinition, actionData, keys, odataRequest);
        }
    }
    async onAfterRead(data, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.onAfterRead) {
            return this._mockDataFn.onAfterRead(data, odataRequest);
        }
        else {
            return super.onAfterRead(data, odataRequest);
        }
    }
    async executeAction(actionDefinition, actionData, keys, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.executeAction) {
            return this._mockDataFn.executeAction(actionDefinition, actionData, keys, odataRequest);
        }
        else {
            return super.executeAction(actionDefinition, actionData, keys, odataRequest);
        }
    }
    async onAfterAction(actionDefinition, actionData, keys, responseData, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.onAfterAction) {
            return this._mockDataFn.onAfterAction(actionDefinition, actionData, keys, responseData, odataRequest);
        }
        else {
            return super.onAfterAction(actionDefinition, actionData, keys, responseData, odataRequest);
        }
    }
    async onDraftPrepare(actionDefinition, responseData, keys, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.onDraftPrepare) {
            return this._mockDataFn.onDraftPrepare(actionDefinition, responseData, keys, odataRequest);
        }
        else {
            return super.onDraftPrepare(actionDefinition, responseData, keys, odataRequest);
        }
    }
    async onAfterUpdateEntry(keyValues, updatedData, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.onAfterUpdateEntry) {
            return this._mockDataFn.onAfterUpdateEntry(keyValues, updatedData, odataRequest);
        }
        else {
            return super.onAfterUpdateEntry(keyValues, updatedData, odataRequest);
        }
    }
    async onBeforeUpdateEntry(keyValues, updatedData, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.onBeforeUpdateEntry) {
            return this._mockDataFn.onBeforeUpdateEntry(keyValues, updatedData, odataRequest);
        }
        else {
            return super.onBeforeUpdateEntry(keyValues, updatedData, odataRequest);
        }
    }
    async onAfterAddEntry(keyValues, data, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.onAfterAddEntry) {
            return this._mockDataFn.onAfterAddEntry(keyValues, data, odataRequest);
        }
        else {
            return super.onAfterAddEntry(keyValues, data, odataRequest);
        }
    }
    async onBeforeAddEntry(keyValues, data, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.onBeforeAddEntry) {
            return this._mockDataFn.onBeforeAddEntry(keyValues, data, odataRequest);
        }
        else {
            return super.onBeforeAddEntry(keyValues, data, odataRequest);
        }
    }
    hasCustomAggregate(customAggregateName, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.hasCustomAggregate) {
            return this._mockDataFn.hasCustomAggregate(customAggregateName, odataRequest);
        }
        else {
            return super.hasCustomAggregate(customAggregateName, odataRequest);
        }
    }
    performCustomAggregate(customAggregateName, dataToAggregate, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.performCustomAggregate) {
            return this._mockDataFn.performCustomAggregate(customAggregateName, dataToAggregate, odataRequest);
        }
        else {
            return super.performCustomAggregate(customAggregateName, dataToAggregate, odataRequest);
        }
    }
    checkSearchQuery(mockValue, searchQuery, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.checkSearchQuery) {
            return this._mockDataFn.checkSearchQuery(mockValue, searchQuery, odataRequest);
        }
        else {
            return super.checkSearchQuery(mockValue, searchQuery, odataRequest);
        }
    }
    checkFilterValue(comparisonType, mockValue, literal, operator, odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.checkFilterValue) {
            return this._mockDataFn.checkFilterValue(comparisonType, mockValue, literal, operator, odataRequest);
        }
        else {
            return super.checkFilterValue(comparisonType, mockValue, literal, operator, odataRequest);
        }
    }
    getReferentialConstraints(_navigationProperty) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.getReferentialConstraints) {
            return this._mockDataFn.getReferentialConstraints(_navigationProperty);
        }
        else {
            return super.getReferentialConstraints(_navigationProperty);
        }
    }
    async getTopLevels(object, _parameters, _odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.getTopLevels) {
            return this._mockDataFn.getTopLevels(object, _parameters, _odataRequest);
        }
        else {
            return super.getTopLevels(object, _parameters, _odataRequest);
        }
    }
    async getDescendants(inputSet, lastFilterTransformationResult, hierarchyData, entityType, _parameters, _odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.getDescendants) {
            return this._mockDataFn.getDescendants(inputSet, lastFilterTransformationResult, hierarchyData, entityType, _parameters, _odataRequest);
        }
        else {
            return super.getDescendants(inputSet, lastFilterTransformationResult, hierarchyData, entityType, _parameters, _odataRequest);
        }
    }
    getAncestors(inputSet, lastFilterTransformationResult, limitedHierarchy, entityType, _parameters, _odataRequest) {
        var _a;
        if ((_a = this._mockDataFn) === null || _a === void 0 ? void 0 : _a.getAncestors) {
            return this._mockDataFn.getAncestors(inputSet, lastFilterTransformationResult, limitedHierarchy, entityType, _parameters, _odataRequest);
        }
        else {
            return super.getAncestors(inputSet, lastFilterTransformationResult, limitedHierarchy, entityType, _parameters, _odataRequest);
        }
    }
}
exports.FunctionBasedMockData = FunctionBasedMockData;
//# sourceMappingURL=functionBasedMockData.js.map