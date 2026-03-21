"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileBasedMockData = exports.getPathOrPropertyPath = exports.isPathExpression = exports.isPropertyPathExpression = void 0;
const annotation_converter_1 = require("@sap-ux/annotation-converter");
const lodash_clonedeep_1 = __importDefault(require("lodash.clonedeep"));
const common_1 = require("../data/common");
function getNumberLength(number) {
    return number.toString().length;
}
function isPropertyPathExpression(expression) {
    return (expression === null || expression === void 0 ? void 0 : expression.type) === 'PropertyPath';
}
exports.isPropertyPathExpression = isPropertyPathExpression;
function isPathExpression(expression) {
    return (expression === null || expression === void 0 ? void 0 : expression.type) === 'Path';
}
exports.isPathExpression = isPathExpression;
function getPathOrPropertyPath(expression) {
    if (isPropertyPathExpression(expression)) {
        return expression.value;
    }
    else if (isPathExpression(expression)) {
        return expression.path;
    }
}
exports.getPathOrPropertyPath = getPathOrPropertyPath;
function performSimpleComparison(operator, mockValue, targetLiteral) {
    let isValid = true;
    switch (operator) {
        case 'gt':
            isValid = mockValue > targetLiteral;
            break;
        case 'ge':
            isValid = mockValue >= targetLiteral;
            break;
        case 'lt':
            isValid = mockValue < targetLiteral;
            break;
        case 'le':
            isValid = mockValue <= targetLiteral;
            break;
        case 'ne':
            isValid = mockValue !== targetLiteral;
            break;
        case 'in':
            isValid = targetLiteral.includes(mockValue);
            break;
        case 'eq':
        default:
            isValid = mockValue === targetLiteral;
            break;
    }
    return isValid;
}
function getNodeProperty(aggregationAnnotation) {
    const nodeProperty = aggregationAnnotation.NodeProperty;
    if (!nodeProperty.$target) {
        throw new Error(`Unknown NodeProperty: '${nodeProperty.value}'`);
    }
    return getPathOrPropertyPath(nodeProperty);
}
function deleteData(currentNode, deepProperty) {
    const deepPropertyPath = deepProperty.split('/');
    let subNode = currentNode;
    for (const deepPropertyPart of deepPropertyPath.slice(0, deepPropertyPath.length - 1)) {
        subNode = currentNode[deepPropertyPart];
    }
    delete subNode[deepPropertyPath[deepPropertyPath.length - 1]];
}
function compareRowData(row1, row2, hierarchyNodeProperty, hierarchySourceProperty, isDraft, applyToActiveEntity) {
    if (isDraft) {
        if (hierarchyNodeProperty === hierarchySourceProperty) {
            return ((0, common_1.getData)(row1, hierarchyNodeProperty) === (0, common_1.getData)(row2, hierarchySourceProperty) &&
                (0, common_1.getData)(row1, 'IsActiveEntity') === (0, common_1.getData)(row2, 'IsActiveEntity'));
        }
        else {
            return ((0, common_1.getData)(row1, hierarchyNodeProperty) === (0, common_1.getData)(row2, hierarchySourceProperty) &&
                (0, common_1.getData)(row1, 'IsActiveEntity') === applyToActiveEntity);
        }
    }
    return (0, common_1.getData)(row1, hierarchyNodeProperty) === (0, common_1.getData)(row2, hierarchySourceProperty);
}
/**
 *
 */
class FileBasedMockData {
    constructor(mockData, entityType, mockDataEntitySet, contextId) {
        this._keyIndex = {};
        this._hierarchyTree = {};
        this._entityType = entityType;
        this._contextId = contextId;
        this._mockDataEntitySet = mockDataEntitySet;
        if (mockData === null || mockData === void 0 ? void 0 : mockData.__forceNullableValuesToNull) {
            this.__forceNullableValuesToNull = true;
        }
        if (mockData.length === 0 && mockData.__generateMockData) {
            this.__generateMockData = true;
            this._mockData = this.generateMockData();
        }
        else {
            this._mockData = (0, lodash_clonedeep_1.default)(mockData);
            if (this._mockData.forEach) {
                this._mockData.forEach((mockLine) => {
                    // We need to ensure that complex types are at least partially created
                    this.validateProperties(mockLine, this._entityType.entityProperties, true, !mockDataEntitySet.isV4());
                });
            }
            this.cleanupHierarchies();
        }
    }
    validateProperties(mockEntry, properties, topLevel = false, isV2 = false) {
        var _a, _b;
        properties.forEach((prop) => {
            var _a;
            if ((!this.__forceNullableValuesToNull || prop.nullable === false) &&
                !mockEntry.hasOwnProperty(prop.name)) {
                mockEntry[prop.name] = this.getDefaultValueFromType(prop, prop.type, prop.targetType, prop.defaultValue);
            }
            else if (mockEntry.hasOwnProperty(prop.name) && (0, annotation_converter_1.isComplexTypeDefinition)(prop.targetType)) {
                // If the property is defined from a complex type we should validate the property of the complex type
                this.validateProperties(mockEntry[prop.name], prop.targetType.properties);
            }
            else if (mockEntry.hasOwnProperty(prop.name) &&
                ['Edm.Int16', 'Edm.Int32', 'Edm.Int64'].includes(prop.type)) {
                if (mockEntry[prop.name] === '') {
                    mockEntry[prop.name] = ''; // hierarchy root node  case
                }
                else {
                    mockEntry[prop.name] = parseInt(mockEntry[prop.name], 10);
                }
            }
            else if (isV2 &&
                mockEntry.hasOwnProperty(prop.name) &&
                ['Edm.DateTime', 'Edm.DateTimeOffset'].includes(prop.type)) {
                if (mockEntry[prop.name] !== '' && !((_a = mockEntry[prop.name]) === null || _a === void 0 ? void 0 : _a.startsWith('/Date('))) {
                    mockEntry[prop.name] = '/Date(' + new Date(mockEntry[prop.name]).getTime() + ')/';
                }
            }
        });
        if ((_b = (_a = this._mockDataEntitySet) === null || _a === void 0 ? void 0 : _a.shouldValidateETag) === null || _b === void 0 ? void 0 : _b.call(_a)) {
            const currentDate = (0, common_1._getDateTimeOffset)(true);
            if (topLevel) {
                mockEntry['@odata.etag'] = `W/\\"${currentDate}\\"`;
            }
        }
    }
    cleanupHierarchies() {
        var _a, _b;
        const allAggregations = (_b = (_a = this._entityType.annotations) === null || _a === void 0 ? void 0 : _a.Aggregation) !== null && _b !== void 0 ? _b : {};
        const hierarchies = Object.keys(allAggregations).filter((aggregationName) => aggregationName.startsWith('RecursiveHierarchy'));
        for (const aggregationName of hierarchies) {
            const aggregationDefinition = allAggregations[aggregationName];
            const hierarchyDefinition = this.getHierarchyDefinition(aggregationDefinition.qualifier, true);
            if (this._mockData.forEach) {
                this._mockData.forEach((mockLine) => {
                    this.cleanupHierarchyData(mockLine, hierarchyDefinition);
                });
            }
        }
    }
    cleanupHierarchyData(mockEntry, hierarchyDefinition) {
        if (hierarchyDefinition.matchedProperty) {
            deleteData(mockEntry, hierarchyDefinition.matchedProperty);
            delete mockEntry[hierarchyDefinition.matchedProperty];
        }
        if (hierarchyDefinition.matchedDescendantCountProperty) {
            deleteData(mockEntry, hierarchyDefinition.matchedDescendantCountProperty);
            delete mockEntry[hierarchyDefinition.matchedDescendantCountProperty];
        }
        if (hierarchyDefinition.limitedDescendantCountProperty) {
            deleteData(mockEntry, hierarchyDefinition.limitedDescendantCountProperty);
            delete mockEntry[hierarchyDefinition.limitedDescendantCountProperty];
        }
        if (hierarchyDefinition.drillStateProperty) {
            deleteData(mockEntry, hierarchyDefinition.drillStateProperty);
            delete mockEntry[hierarchyDefinition.drillStateProperty];
        }
        if (hierarchyDefinition.distanceFromRootProperty) {
            deleteData(mockEntry, hierarchyDefinition.distanceFromRootProperty);
            delete mockEntry[hierarchyDefinition.distanceFromRootProperty];
        }
        if (hierarchyDefinition.limitedRankProperty) {
            deleteData(mockEntry, hierarchyDefinition.limitedRankProperty);
            delete mockEntry[hierarchyDefinition.limitedRankProperty];
        }
    }
    async addEntry(mockEntry, _odataRequest) {
        this._mockData.push(mockEntry);
        this.createKeyIndex();
    }
    async updateEntry(keyValues, updatedData, _patchData, _odataRequest) {
        var _a, _b, _c, _d;
        if (((_b = (_a = this._mockDataEntitySet).shouldValidateETag) === null || _b === void 0 ? void 0 : _b.call(_a)) &&
            _odataRequest.etagReference !== updatedData['@odata.etag']) {
            throw new common_1.ExecutionError('ETag condition not met', 412, { code: 412001, message: 'ETag condition not met' }, false);
        }
        const dataIndex = this.getDataIndex(keyValues, _odataRequest);
        const currentDate = (0, common_1._getDateTimeOffset)(true);
        if ((_d = (_c = this._mockDataEntitySet) === null || _c === void 0 ? void 0 : _c.shouldValidateETag) === null || _d === void 0 ? void 0 : _d.call(_c)) {
            updatedData['@odata.etag'] = `W/\\"${currentDate}\\"`;
        }
        this._mockData[dataIndex] = updatedData;
        this.createKeyIndex();
    }
    fetchIndexFromKey(keys, keyValues, _odataRequest) {
        var _a;
        const fetchedKeys = Object.keys(keyValues);
        const keyIndex = this.createKeyIndex(fetchedKeys);
        if (keyIndex === false) {
            return false;
        }
        const key = fetchedKeys
            .map((keyProp) => {
            const keyValue = keyValues[keyProp];
            if (keyValue && typeof keyValue === 'string' && keyValue.startsWith("guid'")) {
                return keyValue.substring(5, keyValue.length - 1);
            }
            return keyValues[keyProp];
        })
            .join('-');
        return (_a = keyIndex[key]) !== null && _a !== void 0 ? _a : -1;
    }
    async fetchEntries(keyValues, _odataRequest) {
        const keys = this._entityType.keys;
        const indexFromKey = this.fetchIndexFromKey(keys, keyValues, _odataRequest);
        if (indexFromKey !== false) {
            if (indexFromKey === -1) {
                return [];
            }
            return [this._mockData[indexFromKey]];
        }
        return this._mockData.filter((mockData) => {
            return Object.keys(keyValues).every(this.checkKeyValues(mockData, keyValues, keys, _odataRequest));
        });
    }
    hasEntry(keyValues, _odataRequest) {
        return this.getDataIndex(keyValues, _odataRequest) !== -1;
    }
    hasEntries(_odataRequest) {
        return this._mockData.length > 0;
    }
    async getAllEntries(_odataRequest, dontClone = false) {
        if (dontClone) {
            return this._mockData;
        }
        return (0, lodash_clonedeep_1.default)(this._mockData);
    }
    createKeyIndex(keys) {
        if (!keys) {
            this._keyIndex = {};
            keys = this._entityType.keys.map((keyProp) => keyProp.name);
        }
        const indexName = keys.join('-');
        if (this._keyIndex[indexName] === false) {
            return false; // Cannot create an index for those keys
        }
        else if (this._keyIndex[indexName] !== undefined) {
            return this._keyIndex[indexName];
        }
        try {
            const keyIndex = {};
            this._mockData.forEach((mockData, index) => {
                const key = keys
                    .map((keyProp) => {
                    return mockData[keyProp];
                })
                    .join('-');
                if (keyIndex[key] !== undefined) {
                    throw new Error(`Duplicate key found for key ${key}`);
                }
                keyIndex[key] = index;
            });
            this._keyIndex[indexName] = keyIndex;
        }
        catch (e) {
            this._keyIndex[indexName] = false;
        }
        return this._keyIndex[indexName];
    }
    getDataIndex(keyValues, _odataRequest) {
        const keys = this._entityType.keys;
        const indexFromKey = this.fetchIndexFromKey(keys, keyValues, _odataRequest);
        if (indexFromKey !== false) {
            return indexFromKey;
        }
        else {
            return this._mockData.findIndex((mockData) => {
                return Object.keys(keyValues).every(this.checkKeyValues(mockData, keyValues, keys, _odataRequest));
            });
        }
    }
    checkKeyValues(mockData, keyValues, keys, _odataRequest) {
        return (keyName) => {
            return this._mockDataEntitySet.checkKeyValue(mockData, keyValues, keyName, keys.find((keyProp) => keyProp.name === keyName));
        };
    }
    /**
     *
     * @param keyValues
     * @param _odataRequest
     */
    async removeEntry(keyValues, _odataRequest) {
        const dataIndex = this.getDataIndex(keyValues, _odataRequest);
        if (dataIndex !== -1) {
            this._mockData.splice(dataIndex, 1);
        }
        this.createKeyIndex();
    }
    getDefaultValueFromType(property, type, complexType, defaultValue, allowEmptyKeys = false) {
        if (this.__forceNullableValuesToNull && property.nullable) {
            return null;
        }
        if (complexType) {
            if (complexType._type === 'ComplexType') {
                const outData = {};
                complexType.properties.forEach((subProp) => {
                    outData[subProp.name] = this.getDefaultValueFromType(subProp.type, subProp.targetType, subProp.defaultValue);
                });
                return outData;
            }
            else if (complexType._type === 'TypeDefinition') {
                type = complexType.underlyingType;
            }
        }
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        switch (type) {
            case 'Edm.Int16':
            case 'Edm.Byte':
            case 'Edm.Int32':
            case 'Edm.Int64':
            case 'Edm.Double':
            case 'Edm.Decimal':
                return 0;
            case 'Edm.Boolean':
                return false;
            case 'Edm.DateTimeOffset': {
                const date = new Date();
                return this._mockDataEntitySet.isV4() ? date.toISOString() : '/Date(' + date.getTime() + ')/';
            }
            case 'Edm.Date':
            case 'Edm.DateTime': {
                const date = new Date();
                const dateOut = date.getUTCFullYear() +
                    '-' +
                    ('0' + (date.getUTCMonth() + 1)).slice(-2) +
                    '-' +
                    ('0' + date.getUTCDate()).slice(-2);
                return this._mockDataEntitySet.isV4() ? dateOut : '/Date(' + date.getTime() + ')/';
            }
            case 'Edm.Time':
            case 'Time': {
                const date = new Date();
                // ODataModel expects ISO8601 duration format
                return 'PT' + date.getHours() + 'H' + date.getMinutes() + 'M' + date.getSeconds() + 'S';
            }
            default:
                if (property.isKey && !allowEmptyKeys) {
                    return this.generateKey(property, this._mockData.length, this._mockData);
                }
                return '';
        }
    }
    getRandomValueFromType(property, complexType, propertyName, lineIndex) {
        if (this.__forceNullableValuesToNull && property.nullable) {
            return null;
        }
        let type = property.type;
        if (complexType) {
            const outData = {};
            if (complexType._type === 'ComplexType') {
                complexType.properties.forEach((subProp) => {
                    outData[subProp.name] = this.getRandomValueFromType(subProp, subProp.targetType, subProp.name, lineIndex);
                });
                return outData;
            }
            else if (complexType._type === 'TypeDefinition') {
                type = complexType.underlyingType;
            }
        }
        switch (type) {
            case 'Edm.Int16':
            case 'Edm.Int32':
            case 'Edm.Int64':
                return Math.floor(Math.random() * 10000);
            case 'Edm.String':
                if (property.maxLength) {
                    const remainingLength = property.maxLength - getNumberLength(lineIndex) - 2;
                    return `${propertyName.substring(0, remainingLength)}_${lineIndex}`;
                }
                return `${propertyName}_${lineIndex}`;
            case 'Edm.Boolean':
                return Math.random() < 0.5;
            case 'Edm.Byte':
                return Math.floor(Math.random() * 10);
            case 'Edm.Double':
            case 'Edm.Decimal':
                return Math.floor(Math.random() * 100000) / 100;
            case 'Edm.Guid':
                return (0, common_1.uuidv4)();
            case 'Edm.Date':
            case 'Edm.DateTime':
            case 'Edm.DateTimeOffset': {
                const date = new Date();
                date.setFullYear(2000 + Math.floor(Math.random() * 22));
                date.setDate(Math.floor(Math.random() * 30));
                date.setMonth(Math.floor(Math.random() * 12));
                date.setMilliseconds(0);
                if (type === 'Edm.Date') {
                    const dateOut = date.getUTCFullYear() +
                        '-' +
                        ('0' + (date.getUTCMonth() + 1)).slice(-2) +
                        '-' +
                        ('0' + date.getUTCDate()).slice(-2);
                    return this._mockDataEntitySet.isV4() ? dateOut : '/Date(' + date.getTime() + ')/';
                }
                else {
                    return this._mockDataEntitySet.isV4() ? date.toISOString() : '/Date(' + date.getTime() + ')/';
                }
            }
            case 'Edm.Time':
            case 'Time':
                // ODataModel expects ISO8601 duration format
                return ('PT' +
                    Math.floor(Math.random() * 23) +
                    'H' +
                    Math.floor(Math.random() * 59) +
                    'M' +
                    Math.floor(Math.random() * 59) +
                    'S');
            case 'Edm.TimeOfDay':
            case 'Edm.Binary':
            default:
                return '';
        }
    }
    getEmptyObject(_odataRequest, allowEmptyKeys = false) {
        const outObj = {};
        this._entityType.entityProperties.forEach((property) => {
            outObj[property.name] = this.getDefaultValueFromType(property, property.type, property.targetType, property.defaultValue, allowEmptyKeys);
        });
        return outObj;
    }
    getDefaultElement(_odataRequest) {
        if (this._mockData && !Array.isArray(this._mockData)) {
            return this._mockData;
        }
        else if (this._mockData.length >= 1) {
            return (0, lodash_clonedeep_1.default)(this._mockData[0]);
        }
        else {
            return this.getEmptyObject(_odataRequest);
        }
    }
    generateKey(property, lineIndex, mockData = []) {
        const currentMockData = this._mockData || mockData;
        const propertyName = property.name;
        let highestIndex;
        switch (property.type) {
            case 'Edm.Int32':
                highestIndex = 0;
                currentMockData.forEach((mockLine) => {
                    const mockLineIndex = parseInt(mockLine[propertyName], 10);
                    highestIndex = Math.max(highestIndex, mockLineIndex);
                });
                return highestIndex + 1;
            case 'Edm.Boolean':
                return Math.random() > 0.5;
            case 'Edm.Guid':
                return (0, common_1.uuidv4)();
            case 'Edm.String':
                if (lineIndex === undefined) {
                    lineIndex = currentMockData.length + 1;
                }
                if (property.maxLength) {
                    const remainingLength = property.maxLength - getNumberLength(lineIndex);
                    return `${propertyName.substring(0, remainingLength)}${lineIndex}`;
                }
                return `${propertyName}_${lineIndex}`;
            default:
                return (0, common_1.generateId)(12);
        }
    }
    generateMockDataLine(iIndex, mockData) {
        var _a, _b;
        const outObj = {};
        this._entityType.entityProperties.forEach((property) => {
            if (property.isKey) {
                outObj[property.name] = this.generateKey(property, iIndex, mockData);
            }
            else {
                outObj[property.name] = this.getRandomValueFromType(property, property.targetType, property.name, iIndex);
            }
        });
        this._entityType.navigationProperties.forEach((navigationProperty) => {
            if (navigationProperty.containsTarget) {
                outObj[navigationProperty.name] = [];
            }
        });
        if ((_b = (_a = this._mockDataEntitySet) === null || _a === void 0 ? void 0 : _a.shouldValidateETag) === null || _b === void 0 ? void 0 : _b.call(_a)) {
            const currentDate = (0, common_1._getDateTimeOffset)(true);
            outObj['@odata.etag'] = `W/\\"${currentDate}\\"`;
        }
        return outObj;
    }
    getParentEntityInterface() {
        return this._mockDataEntitySet.getParentEntityInterface(this._contextId);
    }
    getEntityInterface(entitySetName, serviceNameOrAlias) {
        return this._mockDataEntitySet.getEntityInterface(entitySetName, serviceNameOrAlias, this._contextId);
    }
    getServiceRegistry() {
        return this._mockDataEntitySet.getServiceRegistry();
    }
    generateMockData() {
        const mockData = [];
        for (let i = 0; i < 150; i++) {
            mockData.push(this.generateMockDataLine(i, mockData));
        }
        return mockData;
    }
    /**
     * Allow to modify the action data beforehand.
     *
     * @param _actionDefinition
     * @param actionData
     * @param _keys
     * @param _odataRequest
     * @returns the modified action data
     */
    async onBeforeAction(_actionDefinition, actionData, _keys, _odataRequest) {
        return actionData;
    }
    /**
     * Do something with the action.
     *
     * @param _actionDefinition
     * @param actionData
     * @param _keys
     * @param _odataRequest
     * @returns the action's result
     */
    async executeAction(_actionDefinition, actionData, _keys, _odataRequest) {
        return actionData;
    }
    /**
     * Allow to modify the response data.
     *
     * @param _actionDefinition
     * @param _actionData
     * @param _keys
     * @param responseData
     * @param _odataRequest
     * @returns the modified response
     */
    async onAfterAction(_actionDefinition, _actionData, _keys, responseData, _odataRequest) {
        return responseData;
    }
    /**
     * Allow to modify the draft preparation.
     *
     * @param _actionDefinition
     * @param _responseData
     * @param _keys
     * @param _odataRequest
     */
    async onDraftPrepare(_actionDefinition, _responseData, _keys, _odataRequest) {
        // Do nothing
    }
    //eslint-disable-next-line
    async onAfterUpdateEntry(_keyValues, _updatedData, _odataRequest) {
        // DO Nothing
    }
    //eslint-disable-next-line
    async onBeforeUpdateEntry(_keyValues, _updatedData, _odataRequest) {
        // DO Nothing
    }
    //eslint-disable-next-line
    async onAfterAddEntry(_keyValues, _data, _odataRequest) {
        // DO Nothing
    }
    //eslint-disable-next-line
    async onBeforeAddEntry(_keyValues, _data, _odataRequest) {
        // DO Nothing
    }
    async onAfterRead(data, _odataRequest) {
        return data;
    }
    //eslint-disable-next-line
    hasCustomAggregate(_customAggregateName, _odataRequest) {
        return false;
    }
    //eslint-disable-next-line
    performCustomAggregate(_customAggregateName, _dataToAggregate, _odataRequest) {
        // DO Nothing
    }
    checkSearchQuery(mockValue, searchQuery, _odataRequest) {
        return mockValue === null || mockValue === void 0 ? void 0 : mockValue.toString().includes(searchQuery);
    }
    checkFilterValue(comparisonType, mockValue, literal, operator, _odataRequest) {
        let isValid = true;
        switch (comparisonType) {
            case 'Edm.Boolean':
                isValid = !!mockValue === (literal === 'true');
                break;
            case 'Edm.Byte':
            case 'Edm.Int16':
            case 'Edm.Int32':
            case 'Edm.Int64': {
                let intTestValue;
                if (typeof literal === 'string') {
                    if (literal.startsWith("'")) {
                        intTestValue = parseInt(literal.substring(1, literal.length - 1), 10);
                    }
                    else {
                        intTestValue = parseInt(literal, 10);
                    }
                }
                else {
                    intTestValue = parseInt(literal, 10);
                }
                mockValue = parseInt(mockValue, 10);
                isValid = performSimpleComparison(operator, mockValue, intTestValue);
                break;
            }
            case 'Edm.Double':
            case 'Edm.Decimal': {
                const decimalTestValue = parseFloat(literal);
                isValid = performSimpleComparison(operator, mockValue, decimalTestValue);
                break;
            }
            case 'Edm.Date':
            case 'Edm.Time':
            case 'Edm.DateTime':
            case 'Edm.DateTimeOffset':
                let targetDateLiteral = literal;
                if (literal) {
                    if (Array.isArray(literal)) {
                        targetDateLiteral = literal.map((literalValue) => {
                            if (literalValue.startsWith("datetime'")) {
                                return literalValue.substring(9, literalValue.length - 1);
                            }
                            return literalValue;
                        });
                    }
                    else if (literal.startsWith("datetime'")) {
                        targetDateLiteral = literal.substring(9, literal.length - 1);
                    }
                }
                let mockValueDate;
                if (mockValue) {
                    if (mockValue.startsWith('/Date(')) {
                        mockValueDate = parseInt(mockValue.substring(6, mockValue.length - 2), 10); // remove 3 trailing 0 and )/
                    }
                    else {
                        mockValueDate = new Date(mockValue).getTime();
                    }
                }
                const testValue = new Date(targetDateLiteral).getTime();
                isValid = performSimpleComparison(operator, mockValueDate, testValue);
                break;
            case 'Edm.String':
            case 'Edm.Guid':
            default:
                let targetLiteral = literal;
                if (literal) {
                    if (Array.isArray(literal)) {
                        targetLiteral = literal.map((literalValue) => {
                            if (literalValue.startsWith("guid'")) {
                                return literalValue.substring(5, literalValue.length - 1);
                            }
                            else if (literalValue.startsWith("'")) {
                                return literalValue.substring(1, literalValue.length - 1);
                            }
                            else {
                                return literalValue;
                            }
                        });
                    }
                    else if (literal.startsWith("guid'")) {
                        targetLiteral = literal.substring(5, literal.length - 1);
                    }
                    else if (literal.startsWith("'")) {
                        targetLiteral = literal.substring(1, literal.length - 1);
                    }
                }
                isValid = performSimpleComparison(operator, mockValue === null || mockValue === void 0 ? void 0 : mockValue.toString(), targetLiteral);
                break;
        }
        return isValid;
    }
    getReferentialConstraints(_navigationProperty) {
        return _navigationProperty.referentialConstraint;
    }
    getSourceReference(aggregationAnnotation) {
        const parentNavigationProperty = aggregationAnnotation.ParentNavigationProperty;
        if (!parentNavigationProperty.$target) {
            throw new Error(`Unknown ParentNavigationProperty: '${parentNavigationProperty.value}'`);
        }
        const referentialConstraint = this.getReferentialConstraints(parentNavigationProperty.$target);
        if (!referentialConstraint || referentialConstraint.length === 0) {
            throw new Error(`Referential constraints must be defined for the ParentNavigationProperty: '${parentNavigationProperty.value}' on entitySet '${this._entityType.name}'`);
        }
        return referentialConstraint[0].sourceProperty;
    }
    buildTree(hierarchyNode, allItems, idNode, depth = 0, parentNode) {
        const id = (0, common_1.getData)(hierarchyNode, idNode);
        const children = allItems[id];
        const resultingChildren = [];
        if (children) {
            for (const child of children) {
                //if (child.$inResultSet === true || child.$inResultSet === undefined) {
                resultingChildren.push(this.buildTree(child, allItems, idNode, depth + 1, hierarchyNode));
                //}
            }
        }
        hierarchyNode.$parent = parentNode;
        hierarchyNode.$children = resultingChildren;
        hierarchyNode.$rootDistance = depth;
        return hierarchyNode;
    }
    buildHierarchyTree(hierarchyQualifier, inputSet, hierarchyDefinition, applyToActiveEntity = true) {
        //if (!this._hierarchyTree[hierarchyQualifier]) {
        const itemPerParents = {};
        inputSet.forEach((item) => {
            var _a;
            if (!this._mockDataEntitySet.isDraft() || item.IsActiveEntity !== !applyToActiveEntity) {
                const parentItemValue = (_a = (0, common_1.getData)(item, hierarchyDefinition.sourceReference)) !== null && _a !== void 0 ? _a : '';
                if (!itemPerParents[parentItemValue]) {
                    itemPerParents[parentItemValue] = [];
                }
                itemPerParents[parentItemValue].push(item);
            }
        });
        this._hierarchyTree[hierarchyQualifier] = itemPerParents;
        return this._hierarchyTree[hierarchyQualifier];
    }
    flattenTree(currentNode, outItems, nodeProperty, hierarchyDefinition, depth, toExpand = [], toCollapse = [], toShow = [], toShowAncestors = [], forceExpand = false) {
        var _a, _b;
        let descendantCount = 0;
        const currentNodeProperty = (0, common_1.getData)(currentNode, nodeProperty);
        const shouldShowAncestor = toShowAncestors.includes(currentNodeProperty);
        if (currentNode && (depth < 0 || depth > 0 || forceExpand || shouldShowAncestor)) {
            const shouldExpand = toExpand.find((toExpand) => toExpand.name === currentNodeProperty);
            if (shouldExpand) {
                depth += shouldExpand.depth;
            }
            const shouldShow = toShow.includes(currentNodeProperty);
            if (shouldShowAncestor && !shouldExpand) {
                forceExpand = true;
            }
            if (shouldShow && !shouldShowAncestor) {
                depth = 1;
            }
            const shouldCollapse = toCollapse.includes(currentNodeProperty);
            if (shouldCollapse) {
                depth = 1;
            }
            const isLastLevel = depth === 1;
            const isPastLastLevel = depth === 0;
            let wasAdded = false;
            if (!outItems.includes(currentNode) &&
                (!isPastLastLevel || !forceExpand || shouldShow || shouldShowAncestor)) {
                wasAdded = true;
                outItems.push(currentNode);
            }
            if (hierarchyDefinition.distanceFromRootProperty) {
                (0, common_1.setData)(currentNode, hierarchyDefinition.distanceFromRootProperty, currentNode.$rootDistance);
            }
            if (hierarchyDefinition.drillStateProperty) {
                if (((_a = currentNode.$children) === null || _a === void 0 ? void 0 : _a.length) === 0) {
                    (0, common_1.setData)(currentNode, hierarchyDefinition.drillStateProperty, 'leaf');
                }
                else if (isLastLevel && !shouldShowAncestor) {
                    (0, common_1.setData)(currentNode, hierarchyDefinition.drillStateProperty, 'collapsed');
                }
                else {
                    (0, common_1.setData)(currentNode, hierarchyDefinition.drillStateProperty, 'expanded');
                }
            }
            const children = (_b = currentNode.$children) !== null && _b !== void 0 ? _b : [];
            children.forEach((child) => {
                descendantCount += this.flattenTree(child, outItems, nodeProperty, hierarchyDefinition, depth - 1, toExpand, toCollapse, toShow, toShowAncestors, forceExpand);
            });
            if (hierarchyDefinition.limitedDescendantCountProperty) {
                (0, common_1.setData)(currentNode, hierarchyDefinition.limitedDescendantCountProperty, isLastLevel && !shouldShowAncestor ? 0 : descendantCount);
            }
            if (currentNode.$inResultSet && wasAdded) {
                descendantCount++;
            }
            return descendantCount;
        }
        return descendantCount;
    }
    getAncestorsOfNode(currentNode, outItems, nodeProperty, hierarchyDefinition, depth, matchedChildrenCount, matchedProperties, isDraft, applyToActiveEntity) {
        var _a, _b;
        let descendantCount = 0;
        if (currentNode && (depth < 0 || depth > 0)) {
            const isLastLevel = depth === 1;
            if (outItems.includes(currentNode)) {
                if (hierarchyDefinition.matchedDescendantCountProperty) {
                    const currentValue = (0, common_1.getData)(currentNode, hierarchyDefinition.matchedDescendantCountProperty);
                    (0, common_1.setData)(currentNode, hierarchyDefinition.matchedDescendantCountProperty, currentValue + matchedChildrenCount);
                }
            }
            else {
                outItems.push(currentNode);
                if (hierarchyDefinition.matchedDescendantCountProperty) {
                    (0, common_1.setData)(currentNode, hierarchyDefinition.matchedDescendantCountProperty, matchedChildrenCount);
                }
                if (hierarchyDefinition.matchedProperty) {
                    (0, common_1.setData)(currentNode, hierarchyDefinition.matchedProperty, !!matchedProperties.find((prop) => compareRowData(prop, currentNode, nodeProperty, nodeProperty, isDraft, applyToActiveEntity)));
                    if ((0, common_1.getData)(currentNode, hierarchyDefinition.matchedProperty)) {
                        matchedChildrenCount++;
                    }
                }
                if (hierarchyDefinition.distanceFromRootProperty) {
                    (0, common_1.setData)(currentNode, hierarchyDefinition.distanceFromRootProperty, currentNode.$rootDistance);
                }
                if (hierarchyDefinition.drillStateProperty) {
                    const includedChildrenCount = (_b = (_a = currentNode.$children) === null || _a === void 0 ? void 0 : _a.filter((child) => child.$inResultSet).length) !== null && _b !== void 0 ? _b : 0;
                    if (isLastLevel && includedChildrenCount === 0) {
                        (0, common_1.setData)(currentNode, hierarchyDefinition.drillStateProperty, 'leaf');
                    }
                    else if (isLastLevel) {
                        (0, common_1.setData)(currentNode, hierarchyDefinition.drillStateProperty, 'collapsed');
                    }
                    else {
                        (0, common_1.setData)(currentNode, hierarchyDefinition.drillStateProperty, 'expanded');
                    }
                }
            }
            if (currentNode.$parent) {
                this.getAncestorsOfNode(currentNode.$parent, outItems, nodeProperty, hierarchyDefinition, depth - 1, matchedChildrenCount, matchedProperties, isDraft, applyToActiveEntity);
            }
            descendantCount++; // also include yourself
            return descendantCount;
        }
        return descendantCount;
    }
    async getTopLevels(data, _parameters, _odataRequest) {
        var _a, _b, _c, _d, _e, _f, _g;
        const hierarchyQualifier = _parameters.HierarchyQualifier.substring(1, _parameters.HierarchyQualifier.length - 1);
        const hierarchyNodes = (_a = _parameters.HierarchyNodes) !== null && _a !== void 0 ? _a : '';
        const applyToActiveEntity = !hierarchyNodes.includes('IsActiveEntity=false');
        const outItems = [];
        const aggregationAnnotation = (_c = (_b = this._entityType.annotations) === null || _b === void 0 ? void 0 : _b.Aggregation) === null || _c === void 0 ? void 0 : _c[`RecursiveHierarchy#${hierarchyQualifier}`];
        if (aggregationAnnotation) {
            const nodeProperty = getNodeProperty(aggregationAnnotation);
            let adjustedData = data.map((adjustedRowData) => {
                const item = this._mockData.find((dataItem) => compareRowData(dataItem, adjustedRowData, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                return { ...item, ...adjustedRowData, ...{ $inResultSet: true } };
            });
            const restOfData = this._mockData
                .filter((item) => {
                if (this._mockDataEntitySet.isDraft() && item.IsActiveEntity === !applyToActiveEntity) {
                    return false;
                }
                return !data.find((dataItem) => compareRowData(dataItem, item, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
            })
                .map((item) => {
                return { ...item, ...{ $inResultSet: false } };
            });
            adjustedData = adjustedData.concat(restOfData);
            const hierarchyDefinition = this.getHierarchyDefinition(hierarchyQualifier);
            const hierarchyNodes = this.buildHierarchyTree(hierarchyQualifier, adjustedData, hierarchyDefinition, applyToActiveEntity);
            const sourceReference = this.getSourceReference(aggregationAnnotation);
            // TODO Considering the input set the top level node is not necessarely the root node
            const allRootNodes = adjustedData.filter((node) => {
                const parent = adjustedData.find((parent) => compareRowData(parent, node, nodeProperty, sourceReference, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                return !parent || !parent.$inResultSet;
            });
            allRootNodes.sort((a) => {
                if (a.$rootDistance === undefined) {
                    return -1;
                }
                return 1;
            });
            // If no 'Levels' value is specified, then all levels are returned
            const depth = _parameters.Levels ? parseInt(_parameters.Levels, 10) : Number.POSITIVE_INFINITY;
            const toExpand = (_e = (_d = _parameters.Expand) === null || _d === void 0 ? void 0 : _d.map((expand) => {
                return { name: expand.substring(1, expand.length - 1), depth: 1 };
            })) !== null && _e !== void 0 ? _e : [];
            const toShow = (_g = (_f = _parameters.Show) === null || _f === void 0 ? void 0 : _f.map((collapse) => collapse.substring(1, collapse.length - 1))) !== null && _g !== void 0 ? _g : [];
            if (_parameters.ExpandLevels) {
                for (const expandLevels of _parameters.ExpandLevels) {
                    toExpand.push({
                        name: expandLevels['"NodeID"'].substring(1, expandLevels['"NodeID"'].length - 1),
                        depth: expandLevels['"Levels"'] && expandLevels['"Levels"'] !== 'null'
                            ? parseInt(expandLevels['"Levels"'], 10)
                            : Number.POSITIVE_INFINITY
                    });
                }
            }
            const toShowAncestors = [];
            for (const nodeId of toShow) {
                const node = this._mockData.find((node) => (0, common_1.getData)(node, nodeProperty) === nodeId);
                if (node) {
                    const toShowAncestorsDef = await this.getAncestors(this._mockData, this._mockData, [node], this._entityType, {
                        hierarchyRoot: '',
                        qualifier: hierarchyQualifier,
                        propertyPath: '',
                        maximumDistance: -1,
                        keepStart: false,
                        inputSetTransformations: []
                    }, _odataRequest);
                    toShowAncestorsDef.forEach((ancestor) => {
                        toShowAncestors.push((0, common_1.getData)(ancestor, nodeProperty));
                    });
                }
            }
            allRootNodes.forEach((rootNode) => {
                var _a;
                const hierarchy = this.buildTree(rootNode, hierarchyNodes, nodeProperty, 0, undefined);
                this.flattenTree(hierarchy, outItems, nodeProperty, hierarchyDefinition, depth, toExpand, (_a = _parameters.Collapse) === null || _a === void 0 ? void 0 : _a.map((collapse) => collapse.substring(1, collapse.length - 1)), toShow, toShowAncestors);
            });
            let outData = [];
            outItems.forEach((item) => {
                const subTreeData = data.find((dataItem) => compareRowData(dataItem, item, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                const nodePropertyValue = (0, common_1.getData)(item, nodeProperty);
                if (subTreeData) {
                    if (hierarchyDefinition.matchedDescendantCountProperty &&
                        hierarchyDefinition.drillStateProperty &&
                        (0, common_1.getData)(item, hierarchyDefinition.matchedDescendantCountProperty) === 0) {
                        (0, common_1.setData)(item, hierarchyDefinition.drillStateProperty, 'leaf');
                    }
                    outData.push({ ...subTreeData, ...item });
                }
                else if (toShow.includes(nodePropertyValue) || toShowAncestors.includes(nodePropertyValue)) {
                    outData.push(item);
                }
            });
            if (hierarchyDefinition.limitedRankProperty) {
                outData.forEach((item, dataIdx) => {
                    (0, common_1.setData)(item, hierarchyDefinition.limitedRankProperty, dataIdx);
                });
            }
            // restrict tree data with skiplocation && skipcontext
            if (_odataRequest.skipLocation) {
                let skipLocation = _odataRequest.skipLocation.split('(')[1].split(')')[0];
                skipLocation = skipLocation.substring(1, skipLocation.length - 1);
                const skipLocationIndex = outData.findIndex((item) => (0, common_1.getData)(item, nodeProperty) === skipLocation);
                if (skipLocationIndex >= _odataRequest.skipContext) {
                    outData = outData.slice(skipLocationIndex - _odataRequest.skipContext);
                    _odataRequest.addResponseAnnotation('@com.sap.vocabularies.Common.v1.skip', skipLocationIndex - _odataRequest.skipContext);
                }
            }
            return outData;
        }
        return outItems;
    }
    async getDescendants(inputSet, lastFilterTransformationResult, hierarchyFilter, entityType, _parameters, _odataRequest) {
        var _a, _b, _c;
        const aggregationAnnotation = (_b = (_a = this._entityType.annotations) === null || _a === void 0 ? void 0 : _a.Aggregation) === null || _b === void 0 ? void 0 : _b[`RecursiveHierarchy#${_parameters.qualifier}`];
        const hierarchyDefinition = this.getHierarchyDefinition(_parameters.qualifier);
        const hierarchyNodes = (_c = _parameters.hierarchyRoot) !== null && _c !== void 0 ? _c : '';
        const applyToActiveEntity = !hierarchyNodes.includes('IsActiveEntity=false');
        if (aggregationAnnotation) {
            const nodeProperty = getNodeProperty(aggregationAnnotation);
            const adjustedData = this._mockData.map((item) => {
                const adjustedRowData = hierarchyFilter.find((dataItem) => compareRowData(dataItem, item, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                if (adjustedRowData) {
                    return { ...item, ...adjustedRowData, ...{ $inResultSet: true } };
                }
                else {
                    return { ...item, ...{ $inResultSet: false } };
                }
            });
            const hierarchyNodes = this.buildHierarchyTree(_parameters.qualifier, adjustedData, hierarchyDefinition, applyToActiveEntity);
            const sourceReference = this.getSourceReference(aggregationAnnotation);
            const rootNodes = hierarchyNodes[''];
            rootNodes.forEach((rootNode) => {
                this.buildTree(rootNode, hierarchyNodes, nodeProperty, 0, undefined);
            });
            const subTrees = [];
            hierarchyFilter.forEach((item) => {
                var _a, _b;
                const parentNodeChildren = hierarchyNodes[(_a = (0, common_1.getData)(item, sourceReference)) !== null && _a !== void 0 ? _a : ''];
                if (parentNodeChildren) {
                    const currentNode = parentNodeChildren.find((node) => compareRowData(node, item, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                    if (currentNode) {
                        if (_parameters.keepStart) {
                            if (hierarchyDefinition.matchedProperty) {
                                // TODO compare with lastFilterTransformationResult
                                (0, common_1.setData)(currentNode, hierarchyDefinition.matchedProperty, true);
                            }
                            subTrees.push(currentNode);
                        }
                        (_b = currentNode.$children) === null || _b === void 0 ? void 0 : _b.forEach((child) => {
                            this.flattenTree(child, subTrees, nodeProperty, hierarchyDefinition, _parameters.maximumDistance);
                        });
                    }
                }
            });
            const outData = [];
            inputSet.forEach((item) => {
                const subTreeData = subTrees.find((dataItem) => compareRowData(dataItem, item, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                if (subTreeData) {
                    if (hierarchyDefinition.matchedDescendantCountProperty &&
                        hierarchyDefinition.drillStateProperty &&
                        (0, common_1.getData)(item, hierarchyDefinition.matchedDescendantCountProperty) === 0) {
                        (0, common_1.setData)(subTreeData, hierarchyDefinition.drillStateProperty, 'leaf');
                    }
                    outData.push({ ...item, ...subTreeData });
                }
            });
            return outData;
        }
        else {
            return [];
        }
    }
    getHierarchyDefinition(hierarchyQualifier, excludeSourceRef = false) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
        const hierarchyAnnotation = (_b = (_a = this._entityType.annotations) === null || _a === void 0 ? void 0 : _a.Hierarchy) === null || _b === void 0 ? void 0 : _b[`RecursiveHierarchy#${hierarchyQualifier}`];
        let sourceReference;
        if (excludeSourceRef === false) {
            const aggregationAnnotation = (_d = (_c = this._entityType.annotations) === null || _c === void 0 ? void 0 : _c.Aggregation) === null || _d === void 0 ? void 0 : _d[`RecursiveHierarchy#${hierarchyQualifier}`];
            sourceReference = this.getSourceReference(aggregationAnnotation);
            return {
                distanceFromRootProperty: (_f = getPathOrPropertyPath((_e = hierarchyAnnotation.DistanceFromRoot) !== null && _e !== void 0 ? _e : hierarchyAnnotation.DistanceFromRootProperty)) !== null && _f !== void 0 ? _f : '$$distanceFromRootProperty',
                drillStateProperty: (_h = getPathOrPropertyPath((_g = hierarchyAnnotation.DrillState) !== null && _g !== void 0 ? _g : hierarchyAnnotation.DrillStateProperty)) !== null && _h !== void 0 ? _h : '$$drillStateProperty',
                limitedDescendantCountProperty: (_k = getPathOrPropertyPath((_j = hierarchyAnnotation.LimitedDescendantCount) !== null && _j !== void 0 ? _j : hierarchyAnnotation.LimitedDescendantCountProperty)) !== null && _k !== void 0 ? _k : '$$limitedDescendantCountProperty',
                limitedRankProperty: getPathOrPropertyPath(hierarchyAnnotation.LimitedRank),
                matchedDescendantCountProperty: (_m = getPathOrPropertyPath((_l = hierarchyAnnotation.MatchedDescendantCount) !== null && _l !== void 0 ? _l : hierarchyAnnotation.MatchedDescendantCountProperty)) !== null && _m !== void 0 ? _m : '$$matchedDescendantCountProperty',
                matchedProperty: (_p = getPathOrPropertyPath((_o = hierarchyAnnotation.Matched) !== null && _o !== void 0 ? _o : hierarchyAnnotation.MatchedProperty)) !== null && _p !== void 0 ? _p : '$$matchedProperty',
                sourceReference
            };
        }
        return {
            distanceFromRootProperty: getPathOrPropertyPath((_q = hierarchyAnnotation.DistanceFromRoot) !== null && _q !== void 0 ? _q : hierarchyAnnotation.DistanceFromRootProperty),
            drillStateProperty: getPathOrPropertyPath((_r = hierarchyAnnotation.DrillState) !== null && _r !== void 0 ? _r : hierarchyAnnotation.DrillStateProperty),
            limitedDescendantCountProperty: getPathOrPropertyPath((_s = hierarchyAnnotation.LimitedDescendantCount) !== null && _s !== void 0 ? _s : hierarchyAnnotation.LimitedDescendantCountProperty),
            limitedRankProperty: getPathOrPropertyPath(hierarchyAnnotation.LimitedRank),
            matchedDescendantCountProperty: getPathOrPropertyPath((_t = hierarchyAnnotation.MatchedDescendantCount) !== null && _t !== void 0 ? _t : hierarchyAnnotation.MatchedDescendantCountProperty),
            matchedProperty: getPathOrPropertyPath((_u = hierarchyAnnotation.Matched) !== null && _u !== void 0 ? _u : hierarchyAnnotation.MatchedProperty)
        };
    }
    async getAncestors(inputSet, lastFilterTransformationResult, limitedHierarchy, entityType, _parameters, _odataRequest) {
        var _a, _b, _c;
        const aggregationAnnotation = (_b = (_a = this._entityType.annotations) === null || _a === void 0 ? void 0 : _a.Aggregation) === null || _b === void 0 ? void 0 : _b[`RecursiveHierarchy#${_parameters.qualifier}`];
        const hierarchyDefinition = this.getHierarchyDefinition(_parameters.qualifier);
        const hierarchyNodes = (_c = _parameters.hierarchyRoot) !== null && _c !== void 0 ? _c : '';
        const applyToActiveEntity = !hierarchyNodes.includes('IsActiveEntity=false');
        if (aggregationAnnotation) {
            const nodeProperty = getNodeProperty(aggregationAnnotation);
            const sourceReference = this.getSourceReference(aggregationAnnotation);
            const adjustedData = this._mockData.map((item) => {
                const adjustedRowData = limitedHierarchy.find((dataItem) => compareRowData(item, dataItem, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                if (adjustedRowData) {
                    return { ...item, ...adjustedRowData, ...{ $inResultSet: true } };
                }
                else {
                    return { ...item, ...{ $inResultSet: false } };
                }
            });
            const hierarchyNodes = this.buildHierarchyTree(_parameters.qualifier, adjustedData, hierarchyDefinition, applyToActiveEntity);
            const rootNodes = hierarchyNodes[''];
            rootNodes.forEach((rootNode) => {
                this.buildTree(rootNode, hierarchyNodes, nodeProperty, 0, undefined);
            });
            const ancestors = [];
            this._mockDataEntitySet.logRequest('Trying to find ancestors comparing ' + nodeProperty, _odataRequest);
            limitedHierarchy.forEach((item) => {
                var _a;
                const parentNodeChildren = hierarchyNodes[(_a = (0, common_1.getData)(item, sourceReference)) !== null && _a !== void 0 ? _a : ''];
                const currentNode = parentNodeChildren.find((node) => compareRowData(node, item, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                if (_parameters.keepStart) {
                    this.getAncestorsOfNode(currentNode, ancestors, nodeProperty, hierarchyDefinition, _parameters.maximumDistance - 1, 0, lastFilterTransformationResult, this._mockDataEntitySet.isDraft(), applyToActiveEntity);
                }
                else if (currentNode && currentNode.$parent) {
                    this.getAncestorsOfNode(currentNode.$parent, ancestors, nodeProperty, hierarchyDefinition, _parameters.maximumDistance - 1, 1, lastFilterTransformationResult, this._mockDataEntitySet.isDraft(), applyToActiveEntity);
                }
            });
            const outData = [];
            inputSet.forEach((item) => {
                const subTreeData = ancestors.find((dataItem) => compareRowData(dataItem, item, nodeProperty, nodeProperty, this._mockDataEntitySet.isDraft(), applyToActiveEntity));
                if (subTreeData) {
                    outData.push({ ...item, ...subTreeData });
                }
            });
            return outData;
        }
        else {
            return [];
        }
    }
}
exports.FileBasedMockData = FileBasedMockData;
//# sourceMappingURL=fileBasedMockData.js.map