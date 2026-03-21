"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceRouter = void 0;
const body_parser_1 = require("body-parser");
const etag_1 = __importDefault(require("etag"));
const router_1 = __importDefault(require("router"));
const url_1 = require("url");
const zlib_1 = require("zlib");
const metadata_1 = require("../data/metadata");
const logger_1 = require("../logger");
const odataRequest_1 = __importDefault(require("../request/odataRequest"));
const batchRouter_1 = require("./batchRouter");
/**
 * Checks if a CSRF Token is requested and adds it to the header if so
 *
 * UI5 may user both methods HEAD or GET with the service document url to fetch
 * the token.
 *
 * @param _req IncomingMessage
 * @param res ServerResponse
 */
const addCSRFTokenIfRequested = (_req, res) => {
    if (_req.headers['X-CSRF-Token'.toLowerCase()] === 'Fetch') {
        res.setHeader('X-CSRF-Token', '0504-71383');
    }
};
/**
 * Small middleware to disable the cache on the queries for the mockserver.
 *
 * @param _req
 * @param res
 * @param next
 */
function disableCache(_req, res, next) {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Expires', '-1');
    res.setHeader('Pragma', 'no-cache');
    next();
}
/**
 * Creates the sub router containing the odata protocol processing.
 *
 * @param service
 * @param dataAccess
 * @returns the sub router specific to that odata query
 */
async function serviceRouter(service, dataAccess) {
    var _a;
    const router = new router_1.default();
    const log = (_a = service.logger) !== null && _a !== void 0 ? _a : (0, logger_1.getLogger)('server:ux-fe-mockserver', !!service.debug);
    router.use(disableCache);
    router.head('/', (_req, res, next) => {
        addCSRFTokenIfRequested(_req, res); //HEAD use case
        next();
    });
    // Deal with the $metadata support
    router.get('/$metadata', (_req, res, next) => {
        if (service.__captureAndSimulate) {
            if (!service.capturing) {
                service.capturing = true;
                // Apply response capture logic
                const originalWrite = res.write;
                const originalEnd = res.end;
                // Capture as buffers
                const capturedBuffers = [];
                res.write = function (chunk, ...args) {
                    if (chunk) {
                        capturedBuffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    }
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    return originalWrite.apply(this, [chunk, ...args]);
                };
                // In res.end, process the captured data
                res.end = function (chunk, ...args) {
                    if (chunk) {
                        capturedBuffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    }
                    // Combine all buffers
                    const fullBuffer = Buffer.concat(capturedBuffers);
                    // Decompress based on content-encoding
                    const contentEncoding = this.getHeader('content-encoding');
                    let decompressedData;
                    try {
                        switch (contentEncoding) {
                            case 'gzip':
                                decompressedData = (0, zlib_1.gunzipSync)(fullBuffer).toString();
                                break;
                            case 'deflate':
                                decompressedData = (0, zlib_1.inflateSync)(fullBuffer).toString();
                                break;
                            case 'br':
                                decompressedData = (0, zlib_1.brotliDecompressSync)(fullBuffer).toString();
                                break;
                            default:
                                decompressedData = fullBuffer.toString();
                        }
                    }
                    catch (error) {
                        // Fallback for decompression errors
                        decompressedData = fullBuffer.toString();
                    }
                    if (!service.noETag) {
                        service.ETag = (0, etag_1.default)(decompressedData, { weak: true });
                    }
                    // Register a service there
                    metadata_1.ODataMetadata.parse(decompressedData, service.urlPath, service.ETag)
                        .then((metadata) => {
                        service.__captureAndSimulate = false;
                        dataAccess.reloadData(metadata);
                    })
                        .catch((err) => {
                        log.error('Failed to parse captured metadata:' + err.message);
                    });
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    return originalEnd.apply(this, [chunk, ...args]);
                };
            }
            delete _req.headers['if-none-match'];
            next();
        }
        else {
            res.setHeader('Content-Type', 'application/xml');
            if (service.ETag) {
                res.setHeader('ETag', service.ETag);
            }
            res.write(dataAccess.getMetadata().getEdmx());
            res.end();
        }
    });
    router.post('/$metadata/reload', (_req, res) => {
        dataAccess.reloadData();
        res.setHeader('Content-Type', 'application/json');
        res.write(JSON.stringify({ message: 'Reload success' }));
        res.end();
    });
    router.get('/', (_req, res) => {
        const allEntitySets = dataAccess.getMetadata().getEntitySets();
        const parsedUrl = new url_1.URL(`http://dummy${_req.url}`);
        let data;
        if (parsedUrl.searchParams.get('$format') === 'json') {
            if (dataAccess.isV4()) {
                data = JSON.stringify({
                    '@odata.context': '$metadata',
                    '@odata.metadataEtag': service.ETag,
                    value: allEntitySets.map((entitySet) => {
                        return {
                            name: entitySet.name,
                            kind: entitySet._type,
                            url: entitySet.name
                        };
                    })
                });
            }
            else {
                data = JSON.stringify({
                    d: { EntitySets: allEntitySets.map((entitySet) => entitySet.name) }
                });
            }
            res.setHeader('content-type', 'application/json');
        }
        else {
            data = `<?xml version="1.0" encoding="utf-8"?>
            <app:service xml:lang="en" xml:base="${service.urlPath}/"
                xmlns:app="http://www.w3.org/2007/app"
                xmlns:atom="http://www.w3.org/2005/Atom"
                xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"
                xmlns:sap="http://www.sap.com/Protocols/SAPData">
                <app:workspace>
                ${allEntitySets
                .map((entitySet) => `<atom:collection href="${entitySet.name}"><atom:title type="text">${entitySet.name}</atom:title><sap:member-title>${entitySet.entityTypeName}</sap:member-title></atom:collection>`)
                .join('')}
                </app:workspace>
                <atom:link rel="self" href="${service.urlPath}/"/>
                <atom:link rel="latest-version" href="${service.urlPath}/"/>
            </app:service>`;
            res.setHeader('Content-Type', 'application/xml');
        }
        addCSRFTokenIfRequested(_req, res); //GET use case
        res.write(data);
        res.end();
    });
    // Standard processing for the incoming message
    router.use((req, res, next) => {
        var _a, _b, _c;
        const parser = (0, body_parser_1.raw)({ type: '*/*' });
        const tenantId = ((_a = req.originalUrl) === null || _a === void 0 ? void 0 : _a.startsWith('/tenant-')) ? (_b = req.originalUrl) === null || _b === void 0 ? void 0 : _b.split('/')[1] : 'tenant-default';
        req.tenantId = tenantId;
        const sapClient = (_c = req.originalUrl) === null || _c === void 0 ? void 0 : _c.includes('sap-client');
        if (sapClient) {
            const parsedUrl = new url_1.URL(`http://dummy${req.originalUrl}`);
            req.tenantId = `tenant-${parsedUrl.searchParams.get('sap-client')}`;
        }
        parser(req, res, function () {
            var _a;
            if (req.body === null ||
                (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
                req.body = '{}';
            }
            else {
                req.body = (_a = req.body) === null || _a === void 0 ? void 0 : _a.toString('utf-8');
            }
            if (req.headers['content-type'] &&
                req.body &&
                req.headers['content-type'].indexOf('application/json') !== -1) {
                try {
                    req.body = JSON.parse(req.body);
                }
                catch (e) {
                    log.error('Error parsing request body');
                    throw new Error('Error parsing request body');
                }
            }
            next();
        });
    });
    router.use('/\\$batch', (0, batchRouter_1.batchRouter)(dataAccess));
    router.route('/*all').all(async (req, res, next) => {
        try {
            if (req.url === '/$metadata') {
                return next();
            }
            const oDataRequest = new odataRequest_1.default({
                url: req.url,
                tenantId: req.tenantId,
                body: req.body,
                headers: req.headers,
                method: req.method
            }, dataAccess);
            await oDataRequest.handleRequest();
            const responseData = oDataRequest.getResponseData();
            res.statusCode = oDataRequest.statusCode;
            for (const responseHeader in oDataRequest.responseHeaders) {
                const value = oDataRequest.responseHeaders[responseHeader];
                if (value) {
                    res.setHeader(responseHeader, value);
                }
            }
            for (const responseHeader in oDataRequest.globalResponseHeaders) {
                const value = oDataRequest.globalResponseHeaders[responseHeader];
                if (value) {
                    res.setHeader(responseHeader, value);
                }
            }
            if (responseData) {
                res.write(responseData);
            }
            res.end();
        }
        catch (e) {
            next(e);
        }
    });
    router.use('*all', (err, _req, res, next) => {
        var _a;
        log.error(err);
        if (res.headersSent) {
            return next(err);
        }
        else {
            res.statusCode = (_a = err.statusCode) !== null && _a !== void 0 ? _a : 500;
            res.write(err.message);
            res.end();
        }
    });
    return router;
}
exports.serviceRouter = serviceRouter;
//# sourceMappingURL=serviceRouter.js.map