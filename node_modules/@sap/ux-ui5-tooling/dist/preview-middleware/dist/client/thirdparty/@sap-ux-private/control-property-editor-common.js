sap.ui.define((function () { 'use strict';

	function _mergeNamespaces(n, m) {
		m.forEach(function (e) {
			e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
				if (k !== 'default' && !(k in n)) {
					var d = Object.getOwnPropertyDescriptor(e, k);
					Object.defineProperty(n, k, d.get ? d : {
						enumerable: true,
						get: function () { return e[k]; }
					});
				}
			});
		});
		return Object.freeze(n);
	}

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var dist = {};

	var api = {};

	var hasRequiredApi;

	function requireApi () {
		if (hasRequiredApi) return api;
		hasRequiredApi = 1;
		(function (exports$1) {
			Object.defineProperty(exports$1, "__esModule", { value: true });
			exports$1.requestControlContextMenu = exports$1.showInfoCenterMessage = exports$1.externalFileChange = exports$1.setApplicationRequiresReload = exports$1.executeContextMenuAction = exports$1.executeQuickAction = exports$1.updateQuickAction = exports$1.quickActionListChanged = exports$1.save = exports$1.redo = exports$1.undo = exports$1.appLoaded = exports$1.setSaveEnablement = exports$1.setUndoRedoEnablement = exports$1.applicationModeChanged = exports$1.setAppMode = exports$1.storageFileChanged = exports$1.reloadApplication = exports$1.toggleAppPreviewVisibility = exports$1.changeStackModified = exports$1.propertyChangeFailed = exports$1.propertyChanged = exports$1.changeProperty = exports$1.outlineChanged = exports$1.deletePropertyChanges = exports$1.addExtensionPoint = exports$1.selectControl = exports$1.controlSelected = exports$1.iconsLoaded = exports$1.EXTERNAL_ACTION_PREFIX = exports$1.REJECTED_SUFFIX = exports$1.FULFILLED_SUFFIX = exports$1.PENDING_SUFFIX = exports$1.MessageBarType = exports$1.NESTED_QUICK_ACTION_KIND = exports$1.SIMPLE_QUICK_ACTION_KIND = exports$1.CONTROL_CHANGE_KIND = exports$1.GENERIC_CHANGE_KIND = exports$1.UNKNOWN_CHANGE_KIND = exports$1.SAVED_CHANGE_TYPE = exports$1.PENDING_CHANGE_TYPE = exports$1.PropertyType = exports$1.SCENARIO = exports$1.CHECKBOX_EDITOR_TYPE = exports$1.DROPDOWN_EDITOR_TYPE = exports$1.INPUT_EDITOR_TYPE = exports$1.STRING_VALUE_TYPE = exports$1.FLOAT_VALUE_TYPE = exports$1.INTEGER_VALUE_TYPE = exports$1.BOOLEAN_VALUE_TYPE = void 0;
			exports$1.createAsyncActionFactory = createAsyncActionFactory;
			exports$1.BOOLEAN_VALUE_TYPE = 'boolean';
			exports$1.INTEGER_VALUE_TYPE = 'integer';
			exports$1.FLOAT_VALUE_TYPE = 'float';
			exports$1.STRING_VALUE_TYPE = 'string';
			exports$1.INPUT_EDITOR_TYPE = 'input';
			exports$1.DROPDOWN_EDITOR_TYPE = 'dropdown';
			exports$1.CHECKBOX_EDITOR_TYPE = 'checkbox';
			exports$1.SCENARIO = {
			    AppVariant: 'APP_VARIANT',
			    VersionedAppVariant: 'VERSIONED_APP_VARIANT',
			    AdaptationProject: 'ADAPTATION_PROJECT',
			    FioriElementsFromScratch: 'FE_FROM_SCRATCH',
			    UiAdaptation: 'UI_ADAPTATION'
			};
			var PropertyType;
			(function (PropertyType) {
			    PropertyType["Configuration"] = "configuration";
			    PropertyType["ControlProperty"] = "controlProperty";
			})(PropertyType || (exports$1.PropertyType = PropertyType = {}));
			exports$1.PENDING_CHANGE_TYPE = 'pending';
			exports$1.SAVED_CHANGE_TYPE = 'saved';
			exports$1.UNKNOWN_CHANGE_KIND = 'unknown';
			exports$1.GENERIC_CHANGE_KIND = 'generic';
			exports$1.CONTROL_CHANGE_KIND = 'control';
			exports$1.SIMPLE_QUICK_ACTION_KIND = 'simple';
			exports$1.NESTED_QUICK_ACTION_KIND = 'nested';
			var MessageBarType;
			(function (MessageBarType) {
			    /** Info styled MessageBar */
			    MessageBarType[MessageBarType["info"] = 0] = "info";
			    /** Error styled MessageBar */
			    MessageBarType[MessageBarType["error"] = 1] = "error";
			    /** Warning styled MessageBar */
			    MessageBarType[MessageBarType["warning"] = 5] = "warning";
			})(MessageBarType || (exports$1.MessageBarType = MessageBarType = {}));
			/**
			 * Create matcher.
			 *
			 * @param type action type
			 * @returns (value: { type: unknown } | undefined) => value is Y
			 */
			function createMatcher(type) {
			    return function match(value) {
			        return value?.type === type;
			    };
			}
			/**
			 * Create action factory.
			 *
			 * @param prefix to determine ext action
			 * @returns Function
			 */
			function createActionFactory(prefix) {
			    return function createAction(name) {
			        const actionType = [prefix, name].join(' ');
			        /**
			         *
			         * @param payload action payload
			         * @returns PayloadAction<typeof actionType, T>
			         */
			        function action(payload) {
			            return {
			                type: actionType,
			                payload
			            };
			        }
			        action.type = actionType;
			        action.match = createMatcher(actionType);
			        return action;
			    };
			}
			exports$1.PENDING_SUFFIX = '<pending>';
			exports$1.FULFILLED_SUFFIX = '<fulfilled>';
			exports$1.REJECTED_SUFFIX = '<rejected>';
			/**
			 * Factory for creating  request response actions.
			 *
			 * @param prefix action prefix
			 * @returns Function
			 */
			function createAsyncActionFactory(prefix) {
			    return function createAction(name) {
			        const pendingType = [prefix, name, exports$1.PENDING_SUFFIX].join(' ');
			        /**
			         * Pending action.
			         *
			         * @param payload action payload
			         * @returns PayloadAction<typeof pendingType, T>
			         */
			        function pending(payload) {
			            return {
			                type: pendingType,
			                payload
			            };
			        }
			        pending.type = pendingType;
			        pending.match = createMatcher(pendingType);
			        const fulfilledType = [prefix, name, exports$1.FULFILLED_SUFFIX].join(' ');
			        /**
			         * Fulfill action.
			         *
			         * @param payload action payload
			         * @returns PayloadAction<typeof fulfilledType, F>
			         */
			        function fulfilled(payload) {
			            return {
			                type: fulfilledType,
			                payload
			            };
			        }
			        fulfilled.type = fulfilledType;
			        fulfilled.match = createMatcher(fulfilledType);
			        const rejectedType = [prefix, name, exports$1.REJECTED_SUFFIX].join(' ');
			        /**
			         * Reject action.
			         *
			         * @param message error message
			         * @param payload R
			         * @returns ErrorAction<typeof rejectedType, F>
			         */
			        function rejected(message, payload) {
			            return {
			                type: rejectedType,
			                payload,
			                error: {
			                    message
			                },
			                showMessage: true
			            };
			        }
			        rejected.type = rejectedType;
			        rejected.match = createMatcher(rejectedType);
			        return {
			            pending,
			            fulfilled,
			            rejected
			        };
			    };
			}
			exports$1.EXTERNAL_ACTION_PREFIX = '[ext]';
			const createExternalAction = createActionFactory(exports$1.EXTERNAL_ACTION_PREFIX);
			exports$1.iconsLoaded = createExternalAction('icons-loaded');
			exports$1.controlSelected = createExternalAction('control-selected');
			exports$1.selectControl = createExternalAction('select-control');
			exports$1.addExtensionPoint = createExternalAction('add-extension-point');
			exports$1.deletePropertyChanges = createExternalAction('delete-property-changes');
			exports$1.outlineChanged = createExternalAction('outline-changed');
			exports$1.changeProperty = createExternalAction('change-property');
			exports$1.propertyChanged = createExternalAction('property-changed');
			exports$1.propertyChangeFailed = createExternalAction('change-property-failed');
			exports$1.changeStackModified = createExternalAction('change-stack-modified');
			exports$1.toggleAppPreviewVisibility = createExternalAction('toggle-app-preview-visibility');
			exports$1.reloadApplication = createExternalAction('reload-application');
			exports$1.storageFileChanged = createExternalAction('storage-file-changed');
			exports$1.setAppMode = createExternalAction('set-app-mode');
			exports$1.applicationModeChanged = createExternalAction('application-mode-changed');
			exports$1.setUndoRedoEnablement = createExternalAction('set-undo-redo-enablement');
			exports$1.setSaveEnablement = createExternalAction('set-save-enablement');
			exports$1.appLoaded = createExternalAction('app-loaded');
			exports$1.undo = createExternalAction('undo');
			exports$1.redo = createExternalAction('redo');
			exports$1.save = createExternalAction('save');
			exports$1.quickActionListChanged = createExternalAction('quick-action-list-changed');
			exports$1.updateQuickAction = createExternalAction('update-quick-action');
			exports$1.executeQuickAction = createExternalAction('execute-quick-action');
			exports$1.executeContextMenuAction = createExternalAction('execute-context-menu-action');
			exports$1.setApplicationRequiresReload = createExternalAction('set-application-requires-reload');
			exports$1.externalFileChange = createExternalAction('external-file-change');
			exports$1.showInfoCenterMessage = createExternalAction('show-info-center-message');
			const createAsyncExternalAction = createAsyncActionFactory(exports$1.EXTERNAL_ACTION_PREFIX);
			exports$1.requestControlContextMenu = createAsyncExternalAction('request-control-context-menu');

		} (api));
		return api;
	}

	var debounce = {};

	var hasRequiredDebounce;

	function requireDebounce () {
		if (hasRequiredDebounce) return debounce;
		hasRequiredDebounce = 1;
		Object.defineProperty(debounce, "__esModule", { value: true });
		debounce.debounce = debounce$1;
		/**
		 * Returns a function which calls the callback function only after the specified idle time
		 * Works similar to the Debounce operator from rxjs https://reactivex.io/documentation/operators/debounce.html link.
		 *
		 * @param callback Function to execute
		 * @param delay Idle period in milliseconds after which the callback will be executed
		 * @returns A wrapper function that should be called to invoke the callback function after delay
		 */
		function debounce$1(callback, delay) {
		    let timerId;
		    return (...args) => {
		        clearTimeout(timerId);
		        timerId = setTimeout(() => {
		            callback(...args);
		        }, delay);
		    };
		}

		return debounce;
	}

	var postMessage = {};

	var hasRequiredPostMessage;

	function requirePostMessage () {
		if (hasRequiredPostMessage) return postMessage;
		hasRequiredPostMessage = 1;
		Object.defineProperty(postMessage, "__esModule", { value: true });
		postMessage.startPostMessageCommunication = startPostMessageCommunication;
		const POST_MESSAGE_ACTION_TYPE = 'post-message-action';
		/**
		 * Check if data isPostMessageAction.
		 *
		 * @param data - post message action
		 * @returns data is PostMessageAction<T>
		 */
		function isPostMessageAction(data) {
		    return data?.type === POST_MESSAGE_ACTION_TYPE && typeof data?.action === 'object';
		}
		/**
		 * Method to start post message communication.
		 *
		 * @param target target window
		 * @param onActionHandler action handler
		 * @param logger to log info, default: browser console.
		 * @returns PostMessageCommunication<T>
		 */
		function startPostMessageCommunication(target, onActionHandler, logger = console) {
		    /**
		     * Returns target windows or undefined.
		     *
		     * @returns Window | undefined
		     */
		    function getTarget() {
		        if (typeof target === 'function') {
		            return target();
		        }
		        return target;
		    }
		    /**
		     * Invoke action on post message.
		     *
		     * @param event event
		     */
		    function postMessageListener(event) {
		        const target = getTarget();
		        if (!target || event.origin !== target.origin || event.source !== target) {
		            // Ignore messages from unknown sources
		            return;
		        }
		        if (isPostMessageAction(event.data)) {
		            onActionHandler(event.data.action).catch((error) => logger.error(error));
		        }
		        else {
		            logger.warn(`Unknown message received ${event.data}`);
		        }
		    }
		    function dispose() {
		        window.removeEventListener('message', postMessageListener);
		    }
		    /**
		     * Post message to a give window.
		     *
		     * @param action action payload
		     */
		    function sendAction(action) {
		        const target = getTarget();
		        if (!target) {
		            return;
		        }
		        const message = {
		            type: POST_MESSAGE_ACTION_TYPE,
		            action
		        };
		        target.postMessage(message, target.origin);
		    }
		    window.addEventListener('message', postMessageListener);
		    return {
		        dispose,
		        sendAction
		    };
		}

		return postMessage;
	}

	var telemetry = {};

	var hasRequiredTelemetry;

	function requireTelemetry () {
		if (hasRequiredTelemetry) return telemetry;
		hasRequiredTelemetry = 1;
		Object.defineProperty(telemetry, "__esModule", { value: true });
		telemetry.enableTelemetry = enableTelemetry;
		telemetry.disableTelemetry = disableTelemetry;
		telemetry.reportTelemetry = reportTelemetry;
		let enabled = false;
		function enableTelemetry() {
		    enabled = true;
		}
		function disableTelemetry() {
		    enabled = false;
		}
		/**
		 * Reports telemetry data from Control Property Editor.
		 *
		 * @param data The TelemetryData object, that needs to be reported
		 * @returns {Promise<void>}
		 */
		async function reportTelemetry(data) {
		    try {
		        if (enabled) {
		            const requestOptions = {
		                method: 'POST',
		                headers: {
		                    Accept: 'application/json',
		                    'Content-Type': 'application/json'
		                },
		                body: JSON.stringify(data)
		            };
		            await fetch('/preview/api/telemetry', requestOptions);
		        }
		    }
		    catch (_error) {
		        // something is wrong with the telemetry service
		        disableTelemetry();
		    }
		}

		return telemetry;
	}

	var utils = {};

	var hasRequiredUtils;

	function requireUtils () {
		if (hasRequiredUtils) return utils;
		hasRequiredUtils = 1;
		Object.defineProperty(utils, "__esModule", { value: true });
		utils.FlexChangesEndPoints = utils.convertCamelCaseToPascalCase = void 0;
		const isUpperCase = (code) => code >= 65 && code <= 90;
		const isLowerCase = (code) => code >= 97 && code <= 122;
		const isWordDelimiter = (code) => code === 45 || code === 95 || code === 32; // - or _ or space
		const convertCamelCaseToPascalCase = (text) => {
		    const words = [];
		    let word = '';
		    let lookForUpperCase = true;
		    for (let i = 0; i < (text ?? '').length; i++) {
		        const character = text[i];
		        if (lookForUpperCase) {
		            // make sure that the first letter is capitalized
		            word += word.length === 0 ? character.toUpperCase() : character;
		            if (isLowerCase(text.charCodeAt(i + 1))) {
		                // First lower case character after upper case character -> switch mode to collect only lower case characters
		                lookForUpperCase = false;
		            }
		            else if (isUpperCase(text.charCodeAt(i + 1)) && isLowerCase(text.charCodeAt(i + 2))) {
		                // Next character is the last uppercase character after a sequence of upper case character -> create an abbreviated word
		                words.push(word);
		                word = '';
		            }
		        }
		        else if (isUpperCase(text.charCodeAt(i))) {
		            // Upper case character indicates the beginning of a new word -> switch mode to detect abbreviated word
		            words.push(word);
		            lookForUpperCase = true;
		            word = character;
		        }
		        else if (isWordDelimiter(text.charCodeAt(i))) {
		            words.push(word);
		            lookForUpperCase = true;
		            word = '';
		        }
		        else {
		            word += character;
		        }
		    }
		    if (word.length) {
		        words.push(word);
		    }
		    return words.join(' ');
		};
		utils.convertCamelCaseToPascalCase = convertCamelCaseToPascalCase;
		var FlexChangesEndPoints;
		(function (FlexChangesEndPoints) {
		    FlexChangesEndPoints["changes"] = "/preview/api/changes";
		})(FlexChangesEndPoints || (utils.FlexChangesEndPoints = FlexChangesEndPoints = {}));

		return utils;
	}

	var hasRequiredDist;

	function requireDist () {
		if (hasRequiredDist) return dist;
		hasRequiredDist = 1;
		(function (exports$1) {
			var __createBinding = (dist && dist.__createBinding) || (Object.create ? (function(o, m, k, k2) {
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
			var __exportStar = (dist && dist.__exportStar) || function(m, exports$1) {
			    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$1, p)) __createBinding(exports$1, m, p);
			};
			Object.defineProperty(exports$1, "__esModule", { value: true });
			exports$1.disableTelemetry = exports$1.enableTelemetry = exports$1.reportTelemetry = exports$1.startPostMessageCommunication = exports$1.debounce = void 0;
			__exportStar(requireApi(), exports$1);
			var debounce_1 = requireDebounce();
			Object.defineProperty(exports$1, "debounce", { enumerable: true, get: function () { return debounce_1.debounce; } });
			var post_message_1 = requirePostMessage();
			Object.defineProperty(exports$1, "startPostMessageCommunication", { enumerable: true, get: function () { return post_message_1.startPostMessageCommunication; } });
			var telemetry_1 = requireTelemetry();
			Object.defineProperty(exports$1, "reportTelemetry", { enumerable: true, get: function () { return telemetry_1.reportTelemetry; } });
			Object.defineProperty(exports$1, "enableTelemetry", { enumerable: true, get: function () { return telemetry_1.enableTelemetry; } });
			Object.defineProperty(exports$1, "disableTelemetry", { enumerable: true, get: function () { return telemetry_1.disableTelemetry; } });
			__exportStar(requireUtils(), exports$1);

		} (dist));
		return dist;
	}

	var distExports = requireDist();
	var defExp = /*@__PURE__*/getDefaultExportFromCjs(distExports);

	var namedExports = /*#__PURE__*/_mergeNamespaces({
		__proto__: null,
		default: defExp
	}, [distExports]);

	const defaultExports = Object.isFrozen(defExp) ? Object.assign({}, defExp?.default || defExp || { __emptyModule: true }) : defExp;
	Object.keys(namedExports || {}).filter((key) => !defaultExports[key]).forEach((key) => defaultExports[key] = namedExports[key]);
	Object.defineProperty(defaultExports, "__" + "esModule", { value: true });
	var index = Object.isFrozen(defExp) ? Object.freeze(defaultExports) : defaultExports;

	return index;

}));
