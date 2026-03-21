"use strict";

sap.ui.define(["./BaseDialog.controller", "sap/ui/model/json/JSONModel", "../../i18n", "open/ux/preview/client/thirdparty/@sap-ux-private/control-property-editor-common", "../../utils/info-center-message", "../command-executor", "../../utils/error", "sap/ui/core/library"], function (__BaseDialog, JSONModel, ____i18n, ___sap_ux_private_control_property_editor_common, ____utils_info_center_message, __CommandExecutor, ____utils_error, sap_ui_core_library) {
  "use strict";

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule && typeof obj.default !== "undefined" ? obj.default : obj;
  }
  const BaseDialog = _interopRequireDefault(__BaseDialog);
  const getResourceModel = ____i18n["getResourceModel"];
  const getTextBundle = ____i18n["getTextBundle"];
  const MessageBarType = ___sap_ux_private_control_property_editor_common["MessageBarType"];
  const sendInfoCenterMessage = ____utils_info_center_message["sendInfoCenterMessage"];
  const CommandExecutor = _interopRequireDefault(__CommandExecutor);
  const getError = ____utils_error["getError"];
  const ValueState = sap_ui_core_library["ValueState"];
  /**
   * Validates Action ID input.
   *
   * @param input control of action ID to validate
   * @param resource text bundle for messages
   * @param validateForDuplicateId custom validation function
   * @return validation result
   */
  function validateActionId(input, resource, validateForDuplicateId) {
    const actionId = input.getValue();
    // Check if empty
    if (!actionId || actionId.trim().length === 0) {
      return {
        isValid: false,
        errorMessage: resource.getText('ACTION_ID_REQUIRED')
      };
    }
    if (typeof validateForDuplicateId === 'function' && !validateForDuplicateId(actionId)) {
      return {
        isValid: false,
        errorMessage: resource.getText('ACTION_WITH_GIVEN_ID_ALREADY_EXISTS', [actionId])
      };
    }

    // Check starts and only allowed characters
    if (!/(^([A-Za-z_][-A-Za-z0-9_.:]*)$)/.test(actionId)) {
      return {
        isValid: false,
        errorMessage: resource.getText('ID_INVALID_FORMAT', ['Action'])
      };
    }
    return {
      isValid: true,
      errorMessage: ''
    };
  }
  const AddActionFragment = BaseDialog.extend("src.adp.controllers.AddActionFragment", {
    constructor: function _constructor(name, overlays, rta, options, telemetryData) {
      BaseDialog.prototype.constructor.call(this, name, telemetryData);
      this.options = options;
      this.rta = rta;
      this.overlays = overlays;
      this.model = new JSONModel({
        title: options.title
      });
      this.commandExecutor = new CommandExecutor(this.rta);
    },
    /**
     * Setups the Dialog and the JSON Model
     *
     * @param {Dialog} dialog - Dialog instance
     */
    setup: async function _setup(dialog) {
      this.dialog = dialog;
      this.setEscapeHandler();
      this.bundle = await getTextBundle();
      await this.buildDialogData();
      const resourceModel = await getResourceModel('open.ux.preview.client');
      this.dialog.setModel(resourceModel, 'i18n');
      this.dialog.setModel(this.model);
      this.dialog.open();
    },
    /**
     * Handles create button press
     *
     * @param event Event
     */
    onCreateBtnPress: async function _onCreateBtnPress(event) {
      const source = event.getSource();
      source.setEnabled(false);
      await BaseDialog.prototype.onCreateBtnPressHandler.call(this);
      const actionId = this.model.getProperty('/actionId');
      const buttonText = this.model.getProperty('/buttonText');
      await this.createAppDescriptorChangeForV4(`${this.options.propertyPath}${actionId}`, buttonText);
      this.handleDialogClose();
    },
    /**
     * Builds data that is used in the dialog
     */
    buildDialogData: async function _buildDialogData() {
      try {
        let hasController = false;
        if (this.options.controllerReference) {
          this.model.setProperty('/handlerReference', this.options.controllerReference);
          hasController = true;
        }
        this.model.setProperty('/hasController', hasController);
      } catch (e) {
        const error = getError(e);
        await sendInfoCenterMessage({
          title: {
            key: 'ADP_GET_FRAGMENTS_FAILURE_TITLE'
          },
          description: error.message,
          type: MessageBarType.error
        });
        throw error;
      }
    },
    /**
     * Checks input values for duplicates and updates confirmation button state based on input validation states
     */
    updateFormState: function _updateFormState() {
      const form = this.dialog.getContent()[0];
      const formContent = form.getContent();
      const inputs = formContent.filter(item => item.isA('sap.m.Input'));
      const beginBtn = this.dialog.getBeginButton();
      // Exclude the last input (display-only) from validation
      // Only validate inputs that are visible and editable
      const validatableInputs = inputs.filter(input => input.getVisible() && input.getEditable());
      beginBtn.setEnabled(validatableInputs.every(input => input.getValueState() === ValueState.Success));
    },
    /**
     * Handles action id input change
     *
     * @param event Event
     */
    onActionIdInputChange: function _onActionIdInputChange(event) {
      // update model value
      const input = event.getSource();
      let modelValue = input.getValue();
      if (modelValue.length < 1) {
        modelValue = null;
      }
      this.model.setProperty('/actionId', modelValue);
      const result = validateActionId(input, this.bundle, this.options.validateActionId);
      if (result.isValid) {
        input.setValueState(ValueState.Success).setValueStateText('');
      } else {
        input.setValueState(ValueState.Error).setValueStateText(result.errorMessage);
      }
      this.updateFormState();
    },
    onButtonTextInputChange: function _onButtonTextInputChange(event) {
      // update model value
      const input = event.getSource();
      let modelValue = input.getValue();
      if (modelValue.length < 1) {
        modelValue = null;
      }
      this.model.setProperty('/buttonText', modelValue);
      if (modelValue && modelValue.length > 0) {
        input.setValueState(ValueState.Success).setValueStateText('');
      } else {
        input.setValueState(ValueState.Error).setValueStateText(this.bundle.getText('BUTTON_TEXT_REQUIRED'));
      }
      this.updateFormState();
    },
    createAppDescriptorChangeForV4: async function _createAppDescriptorChangeForV(propertyPath, actionLabel) {
      const flexSettings = this.rta.getFlexSettings();
      const modifiedValue = {
        reference: this.options.appDescriptor?.projectId,
        appComponent: this.options.appDescriptor?.appComponent,
        changeType: 'appdescr_fe_changePageConfiguration',
        parameters: {
          page: this.options.appDescriptor?.pageId,
          entityPropertyChange: {
            propertyPath: `${propertyPath}`,
            // e.g. 'content/body/sections/test'
            operation: 'UPSERT',
            propertyValue: {
              press: this.options.controllerReference,
              visible: true,
              enabled: true,
              text: actionLabel,
              ...(this.options.actionType === 'tableAction' ? {
                requiresSelection: false
              } : {}),
              ...(this.options.position && {
                position: this.options.position
              })
            }
          }
        }
      };
      const command = await this.commandExecutor.getCommand(this.getRuntimeControl(), 'appDescriptor', modifiedValue, flexSettings);
      await this.commandExecutor.pushAndExecuteCommand(command);
    }
  });
  return AddActionFragment;
});
//# sourceMappingURL=AddActionFragment.controller.js.map