"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchRouter = exports.isPartChangeSet = void 0;
const http = __importStar(require("http"));
const odataRequest_1 = __importDefault(require("../request/odataRequest"));
const batchParser_1 = require("./batchParser");
/**
 * Returns the result whether isRequest part of changeset or not.
 *
 * @param part
 * @returns {boolean}
 */
function isPartChangeSet(part) {
    return part.isChangeSet;
}
exports.isPartChangeSet = isPartChangeSet;
const NL = '\r\n';
/**
 * Returns if the request status code is error (4xx or 5xx).
 *
 * @param partRequest
 * @returns {boolean}
 */
function hasErrorStatusCode(partRequest) {
    var _a;
    const statusCode = ((_a = partRequest === null || partRequest === void 0 ? void 0 : partRequest.statusCode) !== null && _a !== void 0 ? _a : '').toString();
    return statusCode.startsWith('4') || statusCode.startsWith('5');
}
/**
 * Get the part request.
 *
 * @param partDefinition
 * @param dataAccess
 * @param tenantId
 * @returns {ODataRequest}
 */
async function getPartRequest(partDefinition, dataAccess, tenantId) {
    const partRequest = new odataRequest_1.default({ ...partDefinition, tenantId: tenantId }, dataAccess);
    await partRequest.handleRequest();
    return partRequest;
}
/**
 * Get the header of the part response.
 *
 * @param partRequest
 * @param partDefinition
 * @param globalHeaders
 * @returns {string} Response string corresponding to the part request.
 */
function getPartResponseHeaderAsObject(partRequest, partDefinition, globalHeaders) {
    partRequest.getResponseData();
    for (const headerName in partRequest.globalResponseHeaders) {
        globalHeaders[headerName] = partRequest.globalResponseHeaders[headerName];
    }
    return {
        id: partDefinition.contentId,
        status: partRequest.statusCode,
        headers: partRequest.responseHeaders
    };
}
/**
 * Get the header of the part response.
 *
 * @param partRequest
 * @param partDefinition
 * @param globalHeaders
 * @param isChangeSet
 * @param isResponse412
 * @returns {string} Response string corresponding to the part request.
 */
function getPartResponseHeader(partRequest, partDefinition, globalHeaders, isChangeSet = false, isResponse412 = false) {
    let batchResponse = '';
    batchResponse += `Content-Type: application/http${NL}`;
    batchResponse += `Content-Transfer-Encoding: binary${NL}`;
    const contentId = partDefinition.contentId;
    if (!isResponse412 && isChangeSet && contentId) {
        // 1. Final 412 response is a combined one, so it doesn't need explicit content-id in response header.
        // 2. This content-id is presently valid only for change set senarios.
        batchResponse += `Content-ID: ${contentId}${NL}`;
    }
    if (partRequest.getETag()) {
        batchResponse += `ETag: ${partRequest.getETag()}${NL}`;
    }
    batchResponse += NL;
    // NOTE: This function internally adds the response header to 'responseHeaders' of partRequest.
    partRequest.getResponseData();
    batchResponse += `HTTP/1.1 ${partRequest.statusCode} ${http.STATUS_CODES[partRequest.statusCode]}${NL}`;
    for (const headerName in partRequest.responseHeaders) {
        batchResponse += `${headerName}: ${partRequest.responseHeaders[headerName]}${NL}`;
    }
    for (const headerName in partRequest.globalResponseHeaders) {
        globalHeaders[headerName] = partRequest.globalResponseHeaders[headerName];
    }
    batchResponse += NL; // End of part header
    return batchResponse;
}
function getPartResponseAsObject(partRequest, partDefinition, globalHeaders) {
    const baseResponse = getPartResponseHeaderAsObject(partRequest, partDefinition, globalHeaders);
    baseResponse.body = partRequest.getResponseData(false);
    return baseResponse;
}
/**
 * Get the part response.
 *
 * @param partRequest
 * @param partDefinition
 * @param globalHeaders
 * @param isChangeSet
 * @returns {string} Response string corresponding to the part request.
 */
function getPartResponse(partRequest, partDefinition, globalHeaders, isChangeSet = false) {
    let batchResponse = getPartResponseHeader(partRequest, partDefinition, globalHeaders, isChangeSet);
    const responseData = partRequest.getResponseData(true);
    if (responseData) {
        batchResponse += responseData;
        //batchResponse += NL; // End of body content
    }
    batchResponse += NL;
    return batchResponse;
}
/**
 * Get the single error containing all 412 responses.
 *
 * @param errors412
 * @returns {string} Response string containing single error holding all 412 responses.
 */
function getCombined412ErrorResponse(errors412) {
    const errorInfo = {
        header: '',
        error: {
            code: '',
            message: '',
            severity: '',
            details: []
        }
    };
    // Create single error combining all the 412 responses.
    const overall412ErrorInfo = errors412.reduce((accumErrorInfo, { header, error, contentId }, idx) => {
        if (idx === 0) {
            // Add header of only the first 412 error.
            accumErrorInfo.header += header;
            // Setting the first 412 error at the top.
            accumErrorInfo.error = {
                code: error.code,
                message: error.message,
                severity: error['@Common.Severity'],
                details: []
            };
        }
        // Accumulate all remaining errors in error details.
        const details = [...error.details].map((errDetail) => {
            errDetail['@Core.ContentID'] = contentId;
            return errDetail;
        });
        accumErrorInfo.error.details = accumErrorInfo.error.details.concat(details);
        return accumErrorInfo;
    }, errorInfo);
    // Convert the single error into response string.
    let response = '';
    response += overall412ErrorInfo.header;
    response += NL;
    const { error } = overall412ErrorInfo;
    response += JSON.stringify({ error: error });
    response += NL;
    return response;
}
/**
 * Get 412 error information from the request's response.
 *
 * @param partResponseIs412
 * @param partRequest
 * @param changeSetPart
 * @param globalHeaders
 * @returns 412 Error information containing header, error object and content-Id.
 */
function get412ErrorInfo(partResponseIs412, partRequest, changeSetPart, globalHeaders) {
    if (partResponseIs412) {
        const error412Object = partRequest.getResponseData();
        if (typeof error412Object === 'string') {
            return {
                header: getPartResponseHeader(partRequest, changeSetPart, globalHeaders, true, true),
                error: JSON.parse(error412Object).error,
                contentId: changeSetPart.contentId
            };
        }
    }
}
/**
 * Get the change set response.
 *
 * @param changeSet
 * @param dataAccess
 * @param tenantId
 * @param globalHeaders
 * @returns Response string corresponding to the change set request.
 */
async function getChangeSetResponse(changeSet, dataAccess, tenantId, globalHeaders) {
    var _a;
    const errors412 = [];
    let changeSetFailed = false;
    let batchResponse = `Content-Type: multipart/mixed; boundary=${changeSet.boundary}${NL}`;
    batchResponse += NL;
    for (const changeSetPart of changeSet.parts) {
        const partRequest = await getPartRequest(changeSetPart, dataAccess, tenantId);
        const statusCode = ((_a = partRequest === null || partRequest === void 0 ? void 0 : partRequest.statusCode) !== null && _a !== void 0 ? _a : '').toString();
        const partResponseIs412 = statusCode === '412';
        const overallErrorStateIs412 = errors412.length > 0 || partResponseIs412;
        if (overallErrorStateIs412) {
            // 412 encountered.
            const errorInfo412 = get412ErrorInfo(partResponseIs412, partRequest, changeSetPart, globalHeaders);
            if (errorInfo412) {
                errors412.push(errorInfo412);
            }
            // NOTE: If earlier part had a 412 response, so we only accumulate 412 responses from remaining parts.
        }
        else {
            const batchPartRes = getPartResponse(partRequest, changeSetPart, globalHeaders, true);
            if (hasErrorStatusCode(partRequest)) {
                // Other error responses of 4XX and 5XX (ChangeSet failed).
                // We presently override the response and exit in these scenarios.
                // We don't need changeSet boundary in this case as we break out of the loop.
                // NOTE: This might change on implementation of continue-on-error.
                batchResponse = batchPartRes;
                changeSetFailed = true;
                break;
            }
            else if (batchPartRes !== null) {
                // No error
                batchResponse += `--${changeSet.boundary}${NL}`;
                batchResponse += batchPartRes;
            }
        }
    }
    if (errors412.length > 0) {
        // Reset response with combine of 412 errors.
        batchResponse = getCombined412ErrorResponse(errors412);
    }
    else if (!changeSetFailed) {
        // No error, we close the changeset boundary
        batchResponse += `--${changeSet.boundary}--${NL}`;
    }
    return batchResponse;
}
async function jsonBatchHandler(req, res, dataAccess) {
    // JSON batch
    const batchData = req.body;
    const batchResponses = [];
    for (const part of batchData.requests) {
        const partRequest = await getPartRequest(part, dataAccess, req.tenantId);
        batchResponses.push(getPartResponseAsObject(partRequest, part, {}));
    }
    res.setHeader('Content-Type', `application/json`);
    res.setHeader('odata-version', dataAccess.getMetadata().getVersion());
    res.write(JSON.stringify({ responses: batchResponses }));
    res.end();
}
async function standardBatchHandler(req, res, dataAccess) {
    const boundary = (0, batchParser_1.getBoundary)(req.headers['content-type']);
    const body = req.body;
    const batchData = (0, batchParser_1.parseBatch)(new batchParser_1.BatchContent(body), boundary);
    const globalHeaders = {};
    let batchResponse = '';
    for (const part of batchData.parts) {
        batchResponse += `--${batchData.boundary}${NL}`;
        if (isPartChangeSet(part)) {
            batchResponse += await getChangeSetResponse(part, dataAccess, req.tenantId, globalHeaders);
        }
        else {
            const partRequest = await getPartRequest(part, dataAccess, req.tenantId);
            batchResponse += getPartResponse(partRequest, part, globalHeaders);
        }
    }
    batchResponse += `--${batchData.boundary}--${NL}`;
    res.statusCode = 200;
    for (const globalHeaderName in globalHeaders) {
        if (globalHeaders[globalHeaderName]) {
            res.setHeader(globalHeaderName, globalHeaders[globalHeaderName]);
        }
    }
    res.setHeader('Content-Type', `multipart/mixed; boundary=${batchData.boundary}`);
    const version = dataAccess.getMetadata().getVersion();
    if (version === '2.0') {
        res.setHeader('dataserviceversion', version);
    }
    else {
        res.setHeader('odata-version', version);
    }
    res.write(batchResponse);
    res.end();
}
/**
 * Creates a router dedicated to batch request handling.
 *
 * @param dataAccess the current DataAccess object
 * @returns a router function for batch handling
 */
function batchRouter(dataAccess) {
    return async (req, res, next) => {
        try {
            dataAccess.checkSession(req);
            if (req.headers['content-type'] === 'application/json') {
                await jsonBatchHandler(req, res, dataAccess);
            }
            else {
                await standardBatchHandler(req, res, dataAccess);
            }
        }
        catch (e) {
            // Check if the error makes the whole request fail
            const customError = e;
            if (customError.isGlobalRequestError) {
                res.statusCode = customError.statusCode;
                for (const headerName in customError.headers) {
                    res.setHeader(headerName, customError.headers[headerName]);
                }
                res.end();
                return;
            }
            next(e);
        }
    };
}
exports.batchRouter = batchRouter;
//# sourceMappingURL=batchRouter.js.map