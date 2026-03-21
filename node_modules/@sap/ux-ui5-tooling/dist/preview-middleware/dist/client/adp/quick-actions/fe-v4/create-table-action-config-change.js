"use strict";

sap.ui.define(["sap/ui/dt/OverlayRegistry", "../../dialog-factory", "../../../utils/version", "../dialog-enablement-validator", "../../api-handler", "../../utils", "../../../utils/fe-v4", "../table-quick-action-base", "../control-types", "../../../utils/core", "./utils"], function (OverlayRegistry, ____dialog_factory, _____utils_version, ___dialog_enablement_validator, ____api_handler, ____utils, _____utils_fe_v4, ___table_quick_action_base, ___control_types, _____utils_core, ___utils) {
  "use strict";

  const DialogFactory = ____dialog_factory["DialogFactory"];
  const DialogNames = ____dialog_factory["DialogNames"];
  const getUi5Version = _____utils_version["getUi5Version"];
  const isLowerThanMinimalUi5Version = _____utils_version["isLowerThanMinimalUi5Version"];
  const DIALOG_ENABLEMENT_VALIDATOR = ___dialog_enablement_validator["DIALOG_ENABLEMENT_VALIDATOR"];
  const getExistingController = ____api_handler["getExistingController"];
  const getControllerInfoForControl = ____utils["getControllerInfoForControl"];
  const getV4AppComponent = _____utils_fe_v4["getV4AppComponent"];
  const TableQuickActionDefinitionBase = ___table_quick_action_base["TableQuickActionDefinitionBase"];
  const MDC_TABLE_TYPE = ___control_types["MDC_TABLE_TYPE"];
  const isA = _____utils_core["isA"];
  const getPropertyPath = ___utils["getPropertyPath"];
  const CREATE_TABLE_ACTION = 'create-table-action';
  const regexForAnnotationPath = /controlConfiguration\/(?:[^@]+\/)?@com\.sap\.vocabularies\.UI\.v1\.LineItem(?:#[^/]+)?\/actions\//;

  /**
   * Quick Action for adding a custom page action.
   */
  class AddTableActionQuickAction extends TableQuickActionDefinitionBase {
    constructor(context) {
      super(CREATE_TABLE_ACTION, [MDC_TABLE_TYPE], 'QUICK_ACTION_ADD_CUSTOM_TABLE_ACTION', context, undefined, [DIALOG_ENABLEMENT_VALIDATOR]);
    }
    async initialize() {
      this.pageId = this.context.view.getViewData()?.stableId.split('::').pop();
      const version = await getUi5Version();
      if (isLowerThanMinimalUi5Version(version, {
        major: 1,
        minor: 120
      })) {
        return;
      }
      await super.initialize();
    }
    async execute(path) {
      const {
        table
      } = this.tableMap[path];
      const propertyPath = `${getPropertyPath(table)}`;
      if (!table || !propertyPath) {
        return [];
      }
      if (table) {
        const overlay = OverlayRegistry.getOverlay(table) || [];
        const controlInfo = getControllerInfoForControl(table);
        const data = await getExistingController(controlInfo.controllerName);
        const controllerPath = data.controllerPathFromRoot.replaceAll('/', '.').replace(/\.[^.]+$/, '');
        await DialogFactory.createDialog(overlay, this.context.rta, DialogNames.ADD_ACTION, undefined, {
          title: 'QUICK_ACTION_ADD_CUSTOM_TABLE_ACTION',
          controllerReference: controllerPath ? `.extension.${controllerPath}.<methodName>` : '.extension.<ApplicationId.FolderName.ScriptFilename.methodName>',
          actionType: 'tableAction',
          appDescriptor: {
            appComponent: getV4AppComponent(this.context.view),
            appType: 'fe-v4',
            pageId: this.pageId,
            projectId: this.context.flexSettings.projectId
          },
          validateActionId: actionId => {
            const actionPaths = [...this.context.changeService.getAllPendingConfigPropertyPath()].filter(path => regexForAnnotationPath.test(path));
            const idInPendingChanges = actionPaths.includes(`${propertyPath}${actionId}`);
            if (idInPendingChanges) {
              return false;
            }
            if (isA(MDC_TABLE_TYPE, table) && table.getActions().every(action => !action.getAction().getId().endsWith(`CustomAction::${actionId}`))) {
              return true;
            }
            return false;
          },
          position: calculatePosition(table, this.context.view),
          propertyPath
        }, {
          actionName: this.type,
          telemetryEventIdentifier: this.getTelemetryIdentifier()
        });
      }
      return [];
    }
  }
  function calculatePosition(table, view) {
    const actions = table.getActions();
    if (!actions.length) {
      return undefined;
    }
    const annotationAction = actions.findIndex(action => action.getAction().getId().includes('::DataFieldForAction::'));
    const customAction = actions.findIndex(action => action.getAction().getId().includes('::CustomAction::'));
    if (annotationAction === -1 && customAction === -1) {
      return undefined;
    }
    // determine the least index of either annotation or custom action
    let actionIndex;
    if (annotationAction === -1) {
      actionIndex = customAction;
    } else if (customAction === -1) {
      actionIndex = annotationAction;
    } else {
      actionIndex = Math.min(annotationAction, customAction);
    }
    const actionToolBarAction = actions[actionIndex];
    let anchor;
    let action = actionToolBarAction?.getAction();
    if (action) {
      const localId = view.getLocalId(action.getId()) ?? '';
      if (localId.includes('CustomAction::')) {
        const str = localId.substring(Math.max(0, localId.lastIndexOf('CustomAction::')));
        anchor = str.split('::').pop();
      } else {
        anchor = localId.substring(localId.lastIndexOf('DataFieldForAction::'));
      }
    }
    if (!anchor) {
      return undefined;
    }
    return {
      placement: 'Before',
      anchor
    };
  }
  var __exports = {
    __esModule: true
  };
  __exports.CREATE_TABLE_ACTION = CREATE_TABLE_ACTION;
  __exports.AddTableActionQuickAction = AddTableActionQuickAction;
  return __exports;
});
//# sourceMappingURL=create-table-action-config-change.js.map