"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEntityContainer = void 0;
const path_1 = require("path");
const common_1 = require("../data/common");
class MockEntityContainer {
    static async read(mockDataRootFolder, tenantId, fileLoader, dataAccess) {
        var _a;
        const jsPath = (0, path_1.join)(mockDataRootFolder, 'EntityContainer') + '.js';
        const tsPath = (0, path_1.join)(mockDataRootFolder, 'EntityContainer') + '.ts';
        let outData = {};
        const existJS = await fileLoader.exists(jsPath);
        const existTS = ((_a = fileLoader.isTypescriptEnabled) === null || _a === void 0 ? void 0 : _a.call(fileLoader)) === true && (await dataAccess.fileLoader.exists(tsPath));
        if (existJS || existTS) {
            try {
                //eslint-disable-next-line
                outData = await fileLoader.loadJS(existTS ? tsPath : jsPath);
            }
            catch (e) {
                outData = {};
                console.error(e);
            }
        }
        if (typeof outData === 'function') {
            if (typeof outData === 'function') {
                const MockClass = outData;
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                outData = new MockClass();
            }
        }
        if (!outData.executeAction) {
            outData.executeAction = async function (actionDefinition, _actionData, _keys) {
                this.throwError('Unsupported Action', 501, {
                    error: {
                        message: `FunctionImport or Action "${actionDefinition.name}" not mocked`
                    }
                });
                return [];
            };
        }
        outData.throwError = function (message, statusCode = 500, messageData, isSAPMessage = false) {
            throw new common_1.ExecutionError(message, statusCode, messageData, isSAPMessage);
        };
        outData.base = {
            async getEntityInterface(entitySetName) {
                try {
                    const mockEntitySet = await dataAccess.getMockEntitySet(entitySetName);
                    return mockEntitySet === null || mockEntitySet === void 0 ? void 0 : mockEntitySet.getMockData(tenantId);
                }
                catch (e) {
                    return undefined;
                }
            }
        };
        return outData;
    }
}
exports.MockEntityContainer = MockEntityContainer;
//# sourceMappingURL=mockEntityContainer.js.map