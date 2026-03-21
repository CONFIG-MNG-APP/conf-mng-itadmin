"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const balanced_match_1 = __importDefault(require("balanced-match"));
const lodash_merge_1 = __importDefault(require("lodash.merge"));
const query_string_1 = require("query-string");
const url_1 = require("url");
const common_1 = require("../data/common");
const applyParser_1 = require("./applyParser");
const filterParser_1 = require("./filterParser");
const searchParser_1 = require("./searchParser");
function addPathToExpandParameters(path, expandParameter, lambdaVariable, skipLast, removeFromResult) {
    var _a;
    const segments = path.split('/');
    if (segments[0] === lambdaVariable) {
        segments.shift();
    }
    if (skipLast) {
        segments.pop();
    }
    let target = expandParameter;
    for (const segment of segments) {
        target[segment] = (_a = target[segment]) !== null && _a !== void 0 ? _a : {
            expand: {},
            properties: { '*': true },
            removeFromResult: removeFromResult
        };
        target = target[segment].expand;
    }
    return target;
}
class ODataRequest {
    get url() {
        return this.requestContent.url;
    }
    get method() {
        return this.requestContent.method;
    }
    constructor(requestContent, dataAccess) {
        var _a, _b, _c, _d, _e;
        this.requestContent = requestContent;
        this.dataAccess = dataAccess;
        this.expandProperties = {};
        this.responseHeaders = {};
        this.globalResponseHeaders = {};
        this.statusCode = 200;
        this.responseAnnotations = {};
        this.messages = [];
        const parsedUrl = new url_1.URL(`http://dummy${requestContent.url}`);
        this.tenantId = requestContent.tenantId || 'tenant-default';
        this.context = requestContent.url.split('?')[0].substring(1);
        this.dataAccess.log.info(`ODataRequest: ${requestContent.method} ${requestContent.url}`);
        if (this.tenantId) {
            this.addResponseHeader('sap-tenantid', this.tenantId);
        }
        this.isMinimalRepresentation = ((_a = requestContent.headers) === null || _a === void 0 ? void 0 : _a['prefer']) === 'return=minimal';
        this.etagReference = (_b = requestContent.headers) === null || _b === void 0 ? void 0 : _b['if-match'];
        this.isStrictMode = (_e = (_d = (_c = requestContent.headers) === null || _c === void 0 ? void 0 : _c['prefer']) === null || _d === void 0 ? void 0 : _d.includes('handling=strict')) !== null && _e !== void 0 ? _e : false;
        this.queryPath = this.parsePath(parsedUrl.pathname.substring(1));
        this.contentId = requestContent.contentId;
        this.parseParameters(parsedUrl.searchParams);
        if (this.requestContent.method === 'POST') {
            switch (this.headers['x-http-method']) {
                case 'PUT':
                    this.requestContent.method = 'PUT';
                    break;
                case 'MERGE':
                    this.requestContent.method = 'PATCH';
                    break;
                case 'DELETE':
                    this.requestContent.method = 'DELETE';
                    break;
            }
        }
    }
    parseParameters(searchParams) {
        this.allParams = searchParams;
        this.forceLog = searchParams.has('logs');
        this.searchQuery = (0, searchParser_1.parseSearch)(searchParams.get('$search'));
        if (this.dataAccess.getMetadata().getVersion() === '2.0' && this.searchQuery.length === 0) {
            // In v2, there is no official $search support but sometimes `search` without dollar is used
            this.searchQuery = (0, searchParser_1.parseSearch)(searchParams.get('search'));
        }
        this.orderBy = this.parseOrderBy(searchParams.get('$orderby'));
        this.startIndex = parseInt(searchParams.get('$skip') || '', 10);
        this.skipLocation = searchParams.get('sap-skiplocation');
        this.skipContext = parseInt(searchParams.get('sap-skipcontext') || '', 10);
        if (isNaN(this.startIndex)) {
            this.startIndex = 0;
        }
        this.maxElements = parseInt(searchParams.get('$top') || Number.POSITIVE_INFINITY.toString(), 10);
        if (isNaN(this.maxElements)) {
            this.maxElements = Number.POSITIVE_INFINITY;
        }
        this.applyDefinition = (0, applyParser_1.parseApply)(searchParams.get('$apply'));
        this.filterDefinition = (0, filterParser_1.parseFilter)(searchParams.get('$filter'));
        this.countRequested = searchParams.has('$count');
        this.isCountQuery = this.context.endsWith('$count');
        this.selectedProperties = this.parseSelect(searchParams.get('$select'));
        const expandParameters = this.parseExpand(searchParams.get('$expand'));
        this.expandProperties = expandParameters.expand;
        // make sure to expand properties used in $filter and $orderby
        ODataRequest.addExpandForFilters(this.expandProperties, this.filterDefinition);
        ODataRequest.addExpandForOrderBy(this.expandProperties, this.orderBy);
        this.selectedProperties = Object.assign(this.selectedProperties, expandParameters.properties);
        if (this.applyDefinition) {
            const additionalSelectProperty = {};
            this.applyDefinition.forEach((apply) => {
                this._addSelectedPropertiesForApplyExpression(apply, additionalSelectProperty);
            });
            for (const additionalSelectKey of Object.keys(additionalSelectProperty)) {
                addPathToExpandParameters(additionalSelectKey, this.expandProperties, undefined, true);
            }
            this.selectedProperties = Object.assign(this.selectedProperties, additionalSelectProperty);
        }
    }
    get headers() {
        var _a;
        return (_a = this.requestContent.headers) !== null && _a !== void 0 ? _a : {};
    }
    _addSelectedPropertiesForApplyExpression(applyTransformation, additionalSelectProperty) {
        switch (applyTransformation.type) {
            case 'groupBy':
                applyTransformation.groupBy.forEach((groupByProperty) => {
                    additionalSelectProperty[groupByProperty] = true;
                });
                applyTransformation.subTransformations.forEach((subTransformation) => {
                    this._addSelectedPropertiesForApplyExpression(subTransformation, additionalSelectProperty);
                });
                break;
            case 'filter':
                ODataRequest.addExpandForFilters(this.expandProperties, applyTransformation.filterExpr);
                break;
            case 'orderBy':
                applyTransformation.orderBy.forEach((orderByProperty) => {
                    additionalSelectProperty[orderByProperty.name] = true;
                });
                break;
            case 'aggregates':
                applyTransformation.aggregateDef.forEach((aggregateSourceProp) => {
                    additionalSelectProperty[aggregateSourceProp.sourceProperty] = true;
                });
                break;
            case 'concat':
                for (const concatExpressions of applyTransformation.concatExpr) {
                    for (const concatExpression of concatExpressions) {
                        this._addSelectedPropertiesForApplyExpression(concatExpression, additionalSelectProperty);
                    }
                }
                break;
            case 'ancestors':
            case 'descendants':
                applyTransformation.parameters.inputSetTransformations.forEach((subTransformation) => {
                    this._addSelectedPropertiesForApplyExpression(subTransformation, additionalSelectProperty);
                });
                break;
        }
    }
    /**
     * Split a list of properties that can contain sub-requests into an array.
     *
     * @param propertiesQuery OData properties request
     * @param delimiter Property delimiter
     * @returns an array of string with the properties
     */
    splitProperties(propertiesQuery, delimiter = ',') {
        const properties = [];
        let nestingDepth = 0, startIndex = 0, index = 0;
        for (; index < propertiesQuery.length; index++) {
            const char = propertiesQuery[index];
            if (char === delimiter && nestingDepth === 0) {
                // top-level delimiter — end of property
                if (index - startIndex > 0) {
                    properties.push(propertiesQuery.substring(startIndex, index));
                }
                startIndex = index + 1;
            }
            else if (char === '(') {
                nestingDepth++;
            }
            else if (char === ')') {
                nestingDepth--;
            }
        }
        if (index - startIndex > 0) {
            properties.push(propertiesQuery.substring(startIndex));
        }
        if (nestingDepth !== 0) {
            throw new common_1.ExecutionError(`Too many ${nestingDepth > 0 ? 'opening' : 'closing'} parentheses: ${propertiesQuery}`, 400, undefined, false);
        }
        return properties;
    }
    parseExpand(expandParameters) {
        const props = this.splitProperties(expandParameters !== null && expandParameters !== void 0 ? expandParameters : '');
        return props.reduce((reducer, property) => {
            var _a;
            if (this.dataAccess.getMetadata().getVersion() === '4.0') {
                const { pre: name, body: parameters } = (_a = (0, balanced_match_1.default)('(', ')', property)) !== null && _a !== void 0 ? _a : { pre: property, body: '' };
                const parameterSplit = this.splitProperties(parameters, ';');
                const queryPart = parameterSplit.reduce((acc, split) => Object.assign(acc, (0, query_string_1.parse)(split)), {});
                const expandOptions = this.parseExpand(queryPart['$expand']);
                const options = {
                    expand: expandOptions.expand,
                    properties: this.parseSelect(queryPart['$select'])
                };
                for (const expandName of Object.keys(expandOptions.expand)) {
                    options.properties[expandName] = true;
                }
                // $filter
                if (queryPart.$filter) {
                    options.filter = (0, filterParser_1.parseFilter)(queryPart.$filter);
                    ODataRequest.addExpandForFilters(options.expand, options.filter);
                }
                // $orderby
                if (queryPart.$orderby) {
                    options.orderBy = this.parseOrderBy(queryPart.$orderby);
                    ODataRequest.addExpandForOrderBy(options.expand, options.orderBy);
                }
                reducer.expand[name] = options;
                reducer.properties[name] = true;
                return reducer;
            }
            else {
                const propertySplit = property.split('/');
                const name = propertySplit[0];
                const expand = propertySplit[1]
                    ? this.parseExpand(propertySplit.slice(1).join('/'))
                    : { expand: {}, properties: {} };
                if (!reducer.expand[name]) {
                    reducer.expand[name] = {
                        expand: expand.expand,
                        properties: {
                            '*': true
                        }
                    };
                }
                else {
                    reducer.expand[name].expand = (0, lodash_merge_1.default)({}, reducer.expand[name].expand, expand.expand);
                }
                reducer.properties[name] = true;
                return reducer;
            }
        }, { expand: {}, properties: {} });
    }
    parseOrderBy(orderByParameters) {
        if (!orderByParameters) {
            return [];
        }
        const orderByParams = orderByParameters.split(',');
        const orderByDefinition = [];
        orderByParams.forEach((param) => {
            const [paramName, direction] = param.split(' ');
            const realDirection = ['asc', 'desc'].includes(direction)
                ? direction
                : 'asc';
            orderByDefinition.push({ name: paramName, direction: realDirection });
        });
        return orderByDefinition;
    }
    parseSelect(selectParameters) {
        if (selectParameters) {
            return selectParameters.split(',').reduce((selectDefinition, property) => {
                if (property.length > 0) {
                    selectDefinition[property.split('/', 1)[0]] = true;
                }
                return selectDefinition;
            }, {});
        }
        return { '*': true };
    }
    parsePath(path) {
        const pathSplit = path.split('/');
        return pathSplit.reduce((pathArr, pathPart) => {
            // Check for matrix parameters first (e.g., "0001;ps='value';va='value'")
            const matrixParamStart = pathPart.indexOf(';');
            let entity;
            let keys = {};
            let matrixParameters;
            // Extract matrix parameters if present
            if (matrixParamStart > -1) {
                const beforeMatrix = pathPart.substring(0, matrixParamStart);
                const matrixString = pathPart.substring(matrixParamStart + 1);
                // Parse matrix parameters: ;key1=value1;key2=value2
                matrixParameters = {};
                const matrixPairs = matrixString.split(';');
                for (const pair of matrixPairs) {
                    const [key, value] = pair.split('=');
                    if (key && value) {
                        // Decode and remove quotes (both encoded %27 and unencoded ')
                        let decodedValue = decodeURIComponent(value);
                        // Remove surrounding single quotes if present
                        if (decodedValue.startsWith("'") && decodedValue.endsWith("'")) {
                            decodedValue = decodedValue.substring(1, decodedValue.length - 1);
                        }
                        matrixParameters[key] = decodedValue;
                    }
                }
                // Continue processing with the part before matrix parameters
                pathPart = beforeMatrix;
            }
            // Now handle keys (e.g., "Entity(key='value')")
            const keysStart = pathPart.indexOf('(');
            const keysEnd = pathPart.lastIndexOf(')');
            if (keysStart > -1) {
                entity = pathPart.substring(0, keysStart) + pathPart.substring(keysEnd + 1);
                const keysList = pathPart.substring(keysStart + 1, keysEnd).split(',');
                keys = {};
                keysList.forEach((keyValue) => {
                    const [key, value] = keyValue.split('=');
                    if (value) {
                        // .../Entity(ID='abc',IsActiveEntity=true) -> {ID: 'abc', IsActiveEntity: true}
                        keys[key] = ODataRequest.parseKeyValue(value);
                    }
                    else {
                        // .../Entity('abc') -> {'': 'abc'}
                        keys[''] = ODataRequest.parseKeyValue(key);
                    }
                });
            }
            else {
                entity = pathPart;
            }
            const queryPath = { path: entity, keys: keys };
            if (matrixParameters && Object.keys(matrixParameters).length > 0) {
                queryPath.matrixParameters = matrixParameters;
            }
            pathArr.push(queryPath);
            return pathArr;
        }, []);
    }
    /**
     * Parse an OData key value.
     *
     * @param value The key value. Strings are expected to be surrounded by single quotes.
     * @returns The parsed value
     */
    static parseKeyValue(value) {
        value = decodeURIComponent(value);
        // string, e.g. "/Entity(key='abc')?
        if (value.startsWith("'") && value.endsWith("'")) {
            return decodeURIComponent(value.substring(1, value.length - 1));
        }
        // boolean, e.g. "/Entity(key=true)"?
        if (value === 'true' || value === 'false') {
            return value === 'true';
        }
        // number, e.g. "/Entity(key=123)"?
        const number = Number(value);
        if (!isNaN(number)) {
            return number;
        }
        // some other type, e.g. a UUID or a date - leave as string
        return value;
    }
    async handleRequest() {
        try {
            switch (this.requestContent.method) {
                case 'PATCH':
                case 'MERGE':
                case 'PUT': {
                    this.dataAccess.checkSession(this);
                    const updatedData = await this.dataAccess.updateData(this, this.requestContent.body);
                    this.setResponseData(updatedData);
                    break;
                }
                case 'DELETE':
                    await this.dataAccess.deleteData(this);
                    this.statusCode = 204;
                    break;
                case 'POST': {
                    const actionResponse = await this.dataAccess.performAction(this, this.requestContent.body);
                    if (actionResponse === null) {
                        this.setResponseData(await this.dataAccess.createData(this, this.requestContent.body));
                        this.statusCode = 201;
                    }
                    else if (actionResponse === undefined) {
                        this.setResponseData(actionResponse);
                        this.statusCode = 204;
                    }
                    else {
                        this.setResponseData(actionResponse);
                    }
                    break;
                }
                case 'HEAD':
                    break; // do nothing
                case 'GET':
                default: {
                    const actionResponse = await this.dataAccess.performAction(this);
                    if (actionResponse === null) {
                        const retrievedData = await this.dataAccess.getData(this);
                        if (retrievedData === undefined || retrievedData === null) {
                            this.statusCode = 404;
                            this.setResponseData('');
                        }
                        else {
                            this.setResponseData(retrievedData);
                        }
                    }
                    else {
                        this.setResponseData(actionResponse);
                    }
                    break;
                }
            }
        }
        catch (errorInfo) {
            this.dataAccess.log.error(`Error executing OData request: ${errorInfo.message}`);
            this.dataAccess.log.error(`${errorInfo.stack}`);
            const errorInformation = errorInfo;
            if (errorInformation.isCustomError) {
                if (errorInformation.isGlobalRequestError) {
                    // The whole request will fail
                    throw errorInformation;
                }
                if (errorInformation.messageData) {
                    this.addContentIdToErrorMessage(errorInformation.messageData);
                    if (errorInformation.isSAPMessage) {
                        this.addResponseHeader('sap-messages', JSON.stringify(errorInformation.messageData));
                    }
                    else {
                        this.addResponseHeader('content-type', 'application/json;odata.metadata=minimal;IEEE754Compatible=true');
                        this.setResponseData(JSON.stringify(errorInformation.messageData));
                    }
                }
                else {
                    this.addResponseHeader('content-type', 'text/plain');
                    this.setResponseData(errorInformation.message);
                }
                if (Object.keys(errorInformation.headers).length > 0) {
                    Object.keys(errorInformation.headers).forEach((headerName) => {
                        this.addResponseHeader(headerName, errorInformation.headers[headerName]);
                    });
                }
                this.statusCode = errorInformation.statusCode;
            }
            else {
                this.statusCode = 500;
                this.addResponseHeader('content-type', 'text/plain');
                this.setResponseData(errorInformation.message);
            }
        }
        this.dataAccess.resetStickySessionTimeout(this);
    }
    setResponseData(data) {
        this.responseData = data;
    }
    setContext(context) {
        this.context = context;
    }
    setETag(etagValue) {
        this.elementETag = etagValue;
    }
    getETag() {
        if (this.dataAccess.shouldValidateETag()) {
            return this.elementETag;
        }
    }
    getResponseData(asString = true) {
        if (this.messages.length) {
            this.addResponseHeader('sap-messages', JSON.stringify(this.messages));
        }
        if (this.dataAccess.getMetadata().getVersion() === '4.0') {
            this.addResponseHeader('odata-version', '4.0');
        }
        else {
            this.addResponseHeader('dataserviceversion', '2.0');
            this.addResponseHeader('cache-control', 'no-store, no-cache');
        }
        if (typeof this.responseData === 'string') {
            return this.responseData;
        }
        if (typeof this.responseData === 'number' && this.isCountQuery) {
            this.addResponseHeader('content-type', 'text/plain');
            if (asString) {
                return this.responseData.toString();
            }
            else {
                return this.responseData;
            }
        }
        if (this.dataAccess.getMetadata().getVersion() === '4.0') {
            if (this.statusCode === 204) {
                return;
            }
            if (this.isMinimalRepresentation) {
                this.statusCode = 204;
                this.addResponseHeader('preference-applied', 'return=minimal');
                return null;
            }
            else {
                this.addResponseHeader('content-type', 'application/json;odata.metadata=minimal;IEEE754Compatible=true');
                let outContext = this.context || '';
                if (outContext.indexOf('$metadata') === -1) {
                    outContext = `$metadata#${this.context}`;
                }
                let resultObject = {
                    '@odata.context': outContext
                };
                const metadataETags = this.dataAccess.getMetadata().getETag();
                if (metadataETags) {
                    resultObject['@odata.metadataEtag'] = metadataETags;
                }
                if (Object.keys(this.responseAnnotations).length) {
                    resultObject = { ...resultObject, ...this.responseAnnotations };
                }
                if (Array.isArray(this.responseData)) {
                    resultObject['@odata.count'] = this.dataCount;
                    resultObject.value = this.responseData;
                }
                else {
                    resultObject = { ...resultObject, ...this.responseData };
                }
                if (asString) {
                    return JSON.stringify(resultObject);
                }
                else {
                    return resultObject;
                }
            }
        }
        else {
            if (this.statusCode === 204) {
                return;
            }
            this.addResponseHeader('content-type', 'application/json');
            // V2
            const resultObject = { d: {} };
            if (Array.isArray(this.responseData)) {
                resultObject.d.__count = this.dataCount;
                resultObject.d.results = this.responseData;
            }
            else {
                resultObject.d = this.responseData;
            }
            if (asString) {
                return JSON.stringify(resultObject);
            }
            else {
                return resultObject;
            }
        }
    }
    addMessage(code, message, severity, target) {
        this.addCustomMessage({ code, message, numericSeverity: severity, target });
    }
    addCustomMessage(messageData) {
        this.messages.push(messageData);
    }
    addResponseHeader(headerName, headerValue, globalHeader = false) {
        if (globalHeader) {
            this.globalResponseHeaders[headerName] = headerValue;
        }
        else {
            this.responseHeaders[headerName] = headerValue;
        }
    }
    removeResponseHeader(headerName, globalHeader = false) {
        if (globalHeader) {
            delete this.globalResponseHeaders[headerName];
        }
        else {
            delete this.responseHeaders[headerName];
        }
    }
    addResponseAnnotation(annotationName, annotationValue) {
        this.responseAnnotations[annotationName] = annotationValue;
    }
    setDataCount(dataCount) {
        this.dataCount = dataCount;
    }
    static addExpandForFilters(expandOptions, filterDefinition) {
        function expand(expression, expandDefinitions, lambdaVariable) {
            var _a;
            if (typeof expression.identifier === 'string') {
                addPathToExpandParameters(expression.identifier, expandDefinitions, lambdaVariable, true, true);
            }
            else if (((_a = expression.identifier) === null || _a === void 0 ? void 0 : _a.type) === 'lambda') {
                const target = addPathToExpandParameters(expression.identifier.target, expandDefinitions, lambdaVariable, false, true);
                if (expression.identifier.expression && expression.identifier.expression.expressions) {
                    for (const subExpression of expression.identifier.expression.expressions) {
                        expand(subExpression, target, expression.identifier.key);
                    }
                }
            }
        }
        if (filterDefinition === null || filterDefinition === void 0 ? void 0 : filterDefinition.expressions) {
            for (const expression of filterDefinition.expressions) {
                expand(expression, expandOptions);
            }
        }
    }
    /**
     * Adding content-id to error message.
     * This helps map the error to the right request in change set.
     *
     * @param errorObj Object containing error
     * @param errorObj.error Error object
     */
    addContentIdToErrorMessage(errorObj) {
        var _a, _b;
        if (this.contentId && (errorObj === null || errorObj === void 0 ? void 0 : errorObj.error)) {
            errorObj.error['@Core.ContentID'] = this.contentId;
            const details = (_b = (_a = errorObj.error) === null || _a === void 0 ? void 0 : _a.details) !== null && _b !== void 0 ? _b : [];
            details.forEach((errorDetail) => {
                errorDetail['@Core.ContentID'] = this.contentId;
            });
        }
    }
    static addExpandForOrderBy(expandOptions, orderByDefinition) {
        for (const definition of orderByDefinition) {
            addPathToExpandParameters(definition.name, expandOptions, undefined, true, true);
        }
    }
}
exports.default = ODataRequest;
//# sourceMappingURL=odataRequest.js.map