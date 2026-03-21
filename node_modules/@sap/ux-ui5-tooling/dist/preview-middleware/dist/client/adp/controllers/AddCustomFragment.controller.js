"use strict";

sap.ui.define(["sap/ui/model/json/JSONModel", "../../i18n", "../command-executor", "./BaseDialog.controller", "open/ux/preview/client/thirdparty/@sap-ux-private/control-property-editor-common", "../../cpe/communication-service", "../../utils/info-center-message", "../../utils/error", "sap/ui/core/library", "../api-handler"], function (JSONModel, ____i18n, __CommandExecutor, __BaseDialog, ___sap_ux_private_control_property_editor_common, ____cpe_communication_service, ____utils_info_center_message, ____utils_error, sap_ui_core_library, ___api_handler) {
  "use strict";

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule && typeof obj.default !== "undefined" ? obj.default : obj;
  }
  const getResourceModel = ____i18n["getResourceModel"];
  const getTextBundle = ____i18n["getTextBundle"];
  const CommandExecutor = _interopRequireDefault(__CommandExecutor);
  const BaseDialog = _interopRequireDefault(__BaseDialog);
  const MessageBarType = ___sap_ux_private_control_property_editor_common["MessageBarType"];
  const setApplicationRequiresReload = ___sap_ux_private_control_property_editor_common["setApplicationRequiresReload"];
  const CommunicationService = ____cpe_communication_service["CommunicationService"];
  const sendInfoCenterMessage = ____utils_info_center_message["sendInfoCenterMessage"];
  const getError = ____utils_error["getError"];
  const ValueState = sap_ui_core_library["ValueState"];
  const getFragments = ___api_handler["getFragments"];
  /**
   * Validates Control ID input.
   *
   * @param input control of control ID to validate
   * @param validateForDuplicateId custom validation function
   * @return validation result
   */
  function validateControlId(input, resource, identifier = 'Column', validateForDuplicateId) {
    const id = input.getValue();
    // Check if empty
    if (!id || id.trim().length === 0) {
      return {
        isValid: false,
        errorMessage: resource.getText('ID_REQUIRED', [identifier])
      };
    }
    if (typeof validateForDuplicateId === 'function' && !validateForDuplicateId?.(id)) {
      return {
        isValid: false,
        errorMessage: resource.getText('GIVEN_ID_ALREADY_EXISTS', [identifier, id])
      };
    }

    // Check if starts with number
    if (!/(^([A-Za-z_][-A-Za-z0-9_.:]*)$)/.test(id)) {
      return {
        isValid: false,
        errorMessage: resource.getText('ID_INVALID_FORMAT', [identifier])
      };
    }
    return {
      isValid: true,
      errorMessage: ''
    };
  }

  /**
   * @namespace open.ux.preview.client.adp.controllers
   */
  const AddCustomFragment = BaseDialog.extend("open.ux.preview.client.adp.controllers.AddCustomFragment", {
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
      const fragmentName = this.model.getProperty('/newFragmentName');
      const template = `fragments.${fragmentName}`;
      await this.createAppDescriptorChangeForV4(template);
      CommunicationService.sendAction(setApplicationRequiresReload(true));
      await sendInfoCenterMessage({
        title: {
          key: this.options.title ?? 'ADP_ADD_FRAGMENT_DIALOG_TITLE'
        },
        description: {
          key: 'ADP_ADD_FRAGMENT_NOTIFICATION',
          params: [fragmentName]
        },
        type: MessageBarType.warning
      });
      this.handleDialogClose();
    },
    /**
     * Builds data that is used in the dialog
     */
    buildDialogData: async function _buildDialogData() {
      try {
        let isCustomColumnFragment = false;
        if (this.options.type === 'tableColumn') {
          await this.addFragmentListToModel();
          isCustomColumnFragment = true;
        }
        this.model.setProperty('/isCustomColumnFragment', isCustomColumnFragment);
      } catch (e) {
        const error = getError(e);
        await sendInfoCenterMessage({
          title: {
            key: this.options.title ?? 'ADP_ADD_FRAGMENT_DIALOG_TITLE'
          },
          description: error.message,
          type: MessageBarType.error
        });
        throw error;
      }
    },
    addFragmentListToModel: async function _addFragmentListToModel() {
      try {
        const {
          fragments
        } = await getFragments();
        this.model.setProperty('/fragmentList', fragments);
      } catch (e) {
        const error = getError(e);
        await sendInfoCenterMessage({
          title: {
            key: 'ADP_ADD_FRAGMENT_FAILURE_TITLE'
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
     * Handles id input change
     *
     * @param event Event
     */
    onIdInputChange: function _onIdInputChange(event) {
      // update model value
      const input = event.getSource();
      let modelValue = input.getValue();
      if (modelValue.length < 1) {
        modelValue = null;
      }
      this.model.setProperty('/id', modelValue);
      const result = validateControlId(input, this.bundle, 'Column', this.options.validateId);
      if (result.isValid) {
        input.setValueState(ValueState.Success).setValueStateText('');
      } else {
        input.setValueState(ValueState.Error).setValueStateText(result.errorMessage);
      }
      this.updateFormState();
    },
    createAppDescriptorChangeForV4: async function _createAppDescriptorChangeForV(templatePath) {
      const id = this.options.type === 'tableColumn' ? this.model.getProperty('/id') : this.model.getProperty('/newFragmentName');
      const template = `${this.options.appDescriptor?.projectId}.changes.${templatePath}`;
      const anchor = this.options.appDescriptor?.anchor;
      const flexSettings = this.rta.getFlexSettings();
      const modifiedValue = {
        reference: this.options.appDescriptor?.projectId,
        appComponent: this.options.appDescriptor?.appComponent,
        changeType: 'appdescr_fe_changePageConfiguration',
        parameters: {
          page: this.options.appDescriptor?.pageId,
          entityPropertyChange: {
            propertyPath: `${this.options.propertyPath}${id}`,
            // e.g. 'content/body/sections/test'
            operation: 'UPSERT',
            propertyValue: {
              template,
              ...(this.options.type === 'tableColumn' ? {
                header: 'New Column'
              } : {
                title: 'New Custom Section'
              }),
              ...(anchor && {
                position: {
                  placement: 'After',
                  anchor
                }
              })
            }
          }
        }
      };
      const command = await this.commandExecutor.getCommand(this.getRuntimeControl(), 'appDescriptor', modifiedValue, flexSettings);
      await this.commandExecutor.pushAndExecuteCommand(command);
    }
  });
  return AddCustomFragment;
});
//# sourceMappingURL=AddCustomFragment.controller.js.map