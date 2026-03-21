"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StickyMockEntitySet = void 0;
const lodash_clonedeep_1 = __importDefault(require("lodash.clonedeep"));
const common_1 = require("../common");
const entitySet_1 = require("./entitySet");
class Session {
    constructor(contextId, data, sessionTimeout, discardSession) {
        this.contextId = contextId;
        this.data = data;
        this.sessionTimeout = sessionTimeout;
        this.discardSession = discardSession;
        this.resetTimeout();
    }
    resetTimeout() {
        clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.discardSession();
        }, this.sessionTimeout * 1000);
    }
    addSessionToken(odataRequest) {
        odataRequest.addResponseHeader('sap-contextid', this.contextId, true);
        odataRequest.addResponseHeader('sap-http-session-timeout', this.sessionTimeout.toString(), true);
    }
    setData(data) {
        this.data = data;
    }
    getData() {
        return this.data;
    }
    discard(odataRequest) {
        clearTimeout(this.timeoutId);
        this.discardSession();
        // Remove the response headers in case they've already been set
        odataRequest === null || odataRequest === void 0 ? void 0 : odataRequest.removeResponseHeader('sap-contextid', true);
        odataRequest === null || odataRequest === void 0 ? void 0 : odataRequest.removeResponseHeader('sap-http-session-timeout', true);
    }
}
/**
 *
 */
class StickyMockEntitySet extends entitySet_1.MockDataEntitySet {
    constructor(rootFolder, entitySetDefinition, dataAccess, generateMockData, forceNullableValuesToNull) {
        var _a, _b, _c;
        super(rootFolder, entitySetDefinition, dataAccess, generateMockData, forceNullableValuesToNull);
        this.sessions = {};
        const discardAction = (_b = (_a = entitySetDefinition.annotations.Session) === null || _a === void 0 ? void 0 : _a.StickySessionSupported) === null || _b === void 0 ? void 0 : _b.DiscardAction;
        if (discardAction) {
            // determine the (unbound) discard action.
            const metadata = dataAccess.getMetadata();
            const entityContainerPath = metadata.getEntityContainerPath();
            /*
             TODO: Most (all?) of the existing services incorrectly annotate the 'discard' action by its short action
                   name. This code prepends the entity container path if needed so that it can be resolved based on
                   the action import.
            */
            const actionImportFQN = !discardAction.startsWith(entityContainerPath)
                ? `${entityContainerPath}/${discardAction}`
                : `${discardAction}`;
            this.discardAction = (_c = metadata.getActionImportByFQN(actionImportFQN)) === null || _c === void 0 ? void 0 : _c.action;
        }
    }
    createSession(data = {}, sessionTimeout = 120) {
        const contextId = `SID:ANON:${(0, common_1.generateId)(16)}`;
        this.sessions[contextId] = new Session(contextId, data, sessionTimeout, () => {
            delete this.sessions[contextId];
        });
        return this.sessions[contextId];
    }
    getSession(request) {
        const contextId = request.headers['sap-contextid'];
        return contextId ? this.sessions[contextId] : undefined;
    }
    async performPATCH(keyValues, patchData, tenantId, odataRequest) {
        var _a;
        keyValues = this.prepareKeys(keyValues);
        const data = await this.performGET(keyValues, false, tenantId, odataRequest);
        if (!data) {
            throw new common_1.ExecutionError('Not found', 404, undefined, false);
        }
        const currentMockData = this.getMockData(tenantId);
        const updatedData = Object.assign(data, patchData);
        await currentMockData.onBeforeUpdateEntry(keyValues, updatedData, odataRequest);
        if (updatedData.__transient) {
            (_a = this.getSession(odataRequest)) === null || _a === void 0 ? void 0 : _a.setData(updatedData);
        }
        else {
            await currentMockData.updateEntry(keyValues, updatedData, patchData, odataRequest);
        }
        await currentMockData.onAfterUpdateEntry(keyValues, updatedData, odataRequest);
        return updatedData;
    }
    async executeAction(actionDefinition, actionData, odataRequest, keys) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const currentMockData = this.getMockData(odataRequest.tenantId);
        keys = this.prepareKeys(keys);
        actionData = await currentMockData.onBeforeAction(actionDefinition, actionData, keys, odataRequest);
        let responseObject;
        switch (actionDefinition.fullyQualifiedName) {
            // Draft Edit Action
            case `${(_d = (_c = (_b = (_a = this.entitySetDefinition) === null || _a === void 0 ? void 0 : _a.annotations) === null || _b === void 0 ? void 0 : _b.Session) === null || _c === void 0 ? void 0 : _c.StickySessionSupported) === null || _d === void 0 ? void 0 : _d.EditAction}(${actionDefinition.sourceType})`: {
                const data = await this.performGET(keys, false, odataRequest.tenantId, odataRequest);
                const duplicate = Object.assign({}, data);
                this.createSession(duplicate).addSessionToken(odataRequest);
                duplicate.__transient = true;
                duplicate.__keys = keys;
                responseObject = duplicate;
                break;
            }
            case `${(_h = (_g = (_f = (_e = this.entitySetDefinition) === null || _e === void 0 ? void 0 : _e.annotations) === null || _f === void 0 ? void 0 : _f.Session) === null || _g === void 0 ? void 0 : _g.StickySessionSupported) === null || _h === void 0 ? void 0 : _h.NewAction}(${actionDefinition.sourceType})`: {
                // New
                let newObject = currentMockData.getEmptyObject(odataRequest, true); // For new sticky objects, allow empty keys
                newObject = Object.assign(newObject, actionData);
                this.createSession(newObject).addSessionToken(odataRequest);
                newObject.__transient = true;
                odataRequest.setContext(`../$metadata#${(_j = this.entitySetDefinition) === null || _j === void 0 ? void 0 : _j.name}()/$entity`);
                responseObject = newObject;
                break;
            }
            case (_k = this.discardAction) === null || _k === void 0 ? void 0 : _k.fullyQualifiedName:
                // Discard
                (_l = this.getSession(odataRequest)) === null || _l === void 0 ? void 0 : _l.discard(odataRequest);
                responseObject = null;
                break;
            case `${(_q = (_p = (_o = (_m = this.entitySetDefinition) === null || _m === void 0 ? void 0 : _m.annotations) === null || _o === void 0 ? void 0 : _o.Session) === null || _p === void 0 ? void 0 : _p.StickySessionSupported) === null || _q === void 0 ? void 0 : _q.SaveAction}(${actionDefinition.sourceType})`: {
                const session = this.getSession(odataRequest);
                if (!session) {
                    throw new common_1.ExecutionError('Session gone', 400, undefined, false);
                }
                const newData = session.getData();
                if (newData.__keys) {
                    // Key needs to be filled now
                    await currentMockData.updateEntry(newData.__keys, newData, newData, odataRequest);
                }
                else {
                    await this.performPOST({}, newData, odataRequest.tenantId, odataRequest);
                }
                session.discard(odataRequest);
                responseObject = newData;
                break;
            }
            default:
                break;
        }
        responseObject = await currentMockData.onAfterAction(actionDefinition, actionData, keys, responseObject, odataRequest);
        return responseObject;
    }
    async performGET(keyValues, asArray, tenantId, odataRequest, dontClone = false) {
        const session = this.getSession(odataRequest);
        if (session && keyValues && Object.keys(keyValues).length) {
            if ((Object.prototype.hasOwnProperty.call(keyValues, '') && keyValues[''] === '') ||
                this.checkKeys(this.prepareKeys(keyValues), session.getData(), this.entityTypeDefinition.keys)) {
                session.addSessionToken(odataRequest);
                return (0, lodash_clonedeep_1.default)(session.getData());
            }
        }
        return super.performGET(keyValues, asArray, tenantId, odataRequest, dontClone);
    }
    isDiscardAction(action) {
        return action === this.discardAction;
    }
}
exports.StickyMockEntitySet = StickyMockEntitySet;
//# sourceMappingURL=stickyEntitySet.js.map