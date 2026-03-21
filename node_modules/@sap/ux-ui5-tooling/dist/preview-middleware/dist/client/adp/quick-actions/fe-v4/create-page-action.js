"use strict";

sap.ui.define(["sap/ui/dt/OverlayRegistry", "../../dialog-factory", "../simple-quick-action-base", "../../../utils/version", "../dialog-enablement-validator", "../../api-handler", "../../utils", "../../../utils/fe-v4", "../../../utils/core"], function (OverlayRegistry, ____dialog_factory, ___simple_quick_action_base, _____utils_version, ___dialog_enablement_validator, ____api_handler, ____utils, _____utils_fe_v4, _____utils_core) {
  "use strict";

  const DialogFactory = ____dialog_factory["DialogFactory"];
  const DialogNames = ____dialog_factory["DialogNames"];
  const SimpleQuickActionDefinitionBase = ___simple_quick_action_base["SimpleQuickActionDefinitionBase"];
  const getUi5Version = _____utils_version["getUi5Version"];
  const isLowerThanMinimalUi5Version = _____utils_version["isLowerThanMinimalUi5Version"];
  const DIALOG_ENABLEMENT_VALIDATOR = ___dialog_enablement_validator["DIALOG_ENABLEMENT_VALIDATOR"];
  const getExistingController = ____api_handler["getExistingController"];
  const getControllerInfoForControl = ____utils["getControllerInfoForControl"];
  const getV4AppComponent = _____utils_fe_v4["getV4AppComponent"];
  const isA = _____utils_core["isA"];
  const ADD_PAGE_ACTION = 'add-page-action';
  const CONTROL_TYPES = ['sap.f.DynamicPageTitle', 'sap.uxap.ObjectPageLayout'];
  /**
   * Quick Action for adding a custom page action.
   */
  class AddPageActionQuickAction extends SimpleQuickActionDefinitionBase {
    constructor(context) {
      super(ADD_PAGE_ACTION, CONTROL_TYPES, 'QUICK_ACTION_ADD_CUSTOM_PAGE_ACTION', context, [DIALOG_ENABLEMENT_VALIDATOR]);
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
    async execute() {
      if (this.control) {
        const overlay = OverlayRegistry.getOverlay(this.control) || [];
        const controlInfo = getControllerInfoForControl(this.control);
        const data = await getExistingController(controlInfo.controllerName);
        const controllerPath = data.controllerPathFromRoot.replaceAll(/\//g, '.').replace(/\.[^.]+$/, '');
        await DialogFactory.createDialog(overlay, this.context.rta, DialogNames.ADD_ACTION, undefined, {
          title: 'QUICK_ACTION_ADD_CUSTOM_PAGE_ACTION',
          controllerReference: controllerPath ? `.extension.${controllerPath}.<REPLACE_WITH_YOUR_HANDLER_NAME>` : '.extension.<ApplicationId.FolderName.ScriptFilename.methodName>',
          appDescriptor: {
            appComponent: getV4AppComponent(this.context.view),
            appType: 'fe-v4',
            pageId: this.pageId,
            projectId: this.context.flexSettings.projectId
          },
          validateActionId: actionId => {
            const headerActions = [...this.context.changeService.getAllPendingConfigPropertyPath()].filter(path => path.includes('content/header/actions/'));
            const idInPendingChanges = headerActions.length && headerActions.includes(`content/header/actions/${actionId}`);
            if (idInPendingChanges) {
              return false;
            }
            if (isA('sap.f.DynamicPageTitle', this.control) && this.control.getActions().every(action => !action.getId().endsWith(`CustomAction::${actionId}`))) {
              return true;
            }
            if (isA('sap.uxap.ObjectPageLayout', this.control) && this.control.getHeaderTitle()?.getActions().every(action => !action.getId().endsWith(`CustomAction::${actionId}`))) {
              return true;
            }
            return false;
          },
          propertyPath: 'content/header/actions/'
        }, {
          actionName: this.type,
          telemetryEventIdentifier: this.getTelemetryIdentifier()
        });
      }
      return [];
    }
  }
  var __exports = {
    __esModule: true
  };
  __exports.ADD_PAGE_ACTION = ADD_PAGE_ACTION;
  __exports.AddPageActionQuickAction = AddPageActionQuickAction;
  return __exports;
});
//# sourceMappingURL=create-page-action.js.map