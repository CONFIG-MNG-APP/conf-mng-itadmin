"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBatch = exports.getBoundary = exports.Batch = exports.BatchContent = void 0;
function split(input) {
    const LF = '\n';
    const CRLF = '\r\n';
    const a = [];
    let pL = 0;
    let p1 = input.indexOf(CRLF, pL);
    let p2 = input.indexOf(LF, pL);
    while (p1 !== -1 || p2 !== -1) {
        if (p1 !== -1 && p1 <= p2) {
            a.push(input.substring(pL, p1));
            pL = p1 + 2;
        }
        else {
            a.push(input.substring(pL, p2));
            pL = p2 + 1;
        }
        p1 = input.indexOf(CRLF, pL);
        p2 = input.indexOf(LF, pL);
    }
    if (pL < input.length) {
        a.push(input.substring(pL));
    }
    return a;
}
/**
 *
 */
class BatchContent {
    constructor(data) {
        this.type = 0;
        this.stringData = data;
        this.stringSplit = split(data);
        this.pos = 0;
    }
    lookLine() {
        return this.stringSplit[this.pos];
    }
    readLine() {
        return this.stringSplit[this.pos++];
    }
    inc() {
        this.pos++;
    }
}
exports.BatchContent = BatchContent;
class Batch {
    constructor(isChangeSet, boundary) {
        this.isChangeSet = isChangeSet;
        this.boundary = boundary;
        if (this.isChangeSet) {
            this.changeSetErrorResponse = null;
        }
        this.parts = [];
    }
}
exports.Batch = Batch;
function getBoundary(headerValue) {
    const l = headerValue.split(';');
    for (const element of l) {
        const ll = element.split('=');
        if (ll[0].trim() === 'boundary') {
            return ll[1];
        }
    }
    return '';
}
exports.getBoundary = getBoundary;
function readHeader(line) {
    const colPos = line.indexOf(':');
    if (colPos === -1) {
        throw new Error('Invalid header "content-type" in batch part');
    }
    const s0 = line.substring(0, colPos);
    const s1 = line.substring(colPos + 1);
    return {
        name: s0.toLowerCase(),
        value: s1.trim()
    };
}
function readAppHttp(batchContent, boundary) {
    const headers = {};
    const payload = [];
    let state = 0; //read url
    const rawUrl = batchContent.readLine();
    state = 1; //read header
    let line = batchContent.lookLine();
    while (line !== null && line !== undefined && line.indexOf(boundary) !== 0) {
        if (state === 1) {
            if (line.length === 0) {
                state = 2; //read body
                batchContent.inc();
            }
            else {
                const h = readHeader(line);
                headers[h.name] = h.value;
                batchContent.inc();
            }
        }
        else if (state === 2) {
            payload.push(line);
            batchContent.inc();
        }
        line = batchContent.lookLine();
    }
    if (line === undefined) {
        throw new Error('Invalid boundary while parsing batch request. Expect boundary ' + boundary);
    }
    const [method, url] = rawUrl.split(' ');
    let actualBody;
    if (payload.length > 0) {
        try {
            actualBody = JSON.parse(payload[0]);
        }
        catch (e) {
            actualBody = payload[0];
        }
    }
    return {
        url: `/${url}`,
        method: method,
        headers: headers,
        body: actualBody
    };
}
function extractContent(batchContent, headers, boundary) {
    let content;
    if (!headers['content-type']) {
        throw new Error('Missing header "content-type" in batch part');
    }
    else if (headers['content-type'] === 'application/http') {
        content = readAppHttp(batchContent, boundary);
        if (headers['content-id']) {
            content.contentId = headers['content-id'];
        }
    }
    else if (headers['content-type'].indexOf('multipart/mixed;') > -1) {
        const changeSetBoundary = getBoundary(headers['content-type']);
        content = parseBatch(batchContent, changeSetBoundary, true);
    }
    return content;
}
function parsePart(batchContent, boundary) {
    const boundaryNext = boundary;
    const boundaryEnd = boundary + '--';
    const headers = {};
    let content;
    let state = 1; //read header
    let line = batchContent.lookLine();
    while (line !== null && line !== undefined && line !== boundaryNext && line !== boundaryEnd) {
        if (state === 1) {
            if (line.length === 0) {
                state = 2; //read body
                batchContent.inc();
            }
            else {
                const h = readHeader(line);
                headers[h.name] = h.value;
                batchContent.inc();
            }
        }
        else if (state === 2) {
            content = extractContent(batchContent, headers, boundary);
        }
        line = batchContent.lookLine();
    }
    if (line === undefined) {
        throw new Error('Invalid boundary while parsing batch request. Expect boundary ' + boundary);
    }
    return content;
}
function parseBatch(content, boundary, isChangeset = false) {
    const boundaryNext = '--' + boundary;
    const boundaryEnd = '--' + boundary + '--';
    const batch = new Batch(isChangeset, boundary);
    let part;
    let line = content.readLine();
    while (line !== null && line !== undefined && line !== boundaryNext) {
        //read lines before first boundary
        line = content.readLine();
    }
    if (line === undefined) {
        throw new Error('Invalid boundary while parsing batch request');
    }
    //line is now read boundary
    line = content.lookLine(); //read line behind
    while (line !== null && line !== undefined && line !== boundaryEnd) {
        part = parsePart(content, boundaryNext);
        if (part) {
            batch.parts.push(part);
        }
        line = content.lookLine(); //now on boundary
        if (line === boundaryNext) {
            line = content.readLine(); //consume boundaryNext
        }
    }
    content.readLine(); //consume boundaryEnd
    line = content.lookLine(); //read line behind
    while (line !== null && line !== undefined && line.length === 0) {
        //read empty lines after first boundary end
        content.readLine();
        line = content.lookLine();
    }
    return batch;
}
exports.parseBatch = parseBatch;
//# sourceMappingURL=batchParser.js.map