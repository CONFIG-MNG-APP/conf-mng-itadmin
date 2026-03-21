"use strict";

sap.ui.define(["../../utils/core", "../../adp/quick-actions/control-types"], function (____utils_core, ____adp_quick_actions_control_types) {
  "use strict";

  const getControlBySelector = ____utils_core["getControlBySelector"];
  const findViewByControl = ____utils_core["findViewByControl"];
  const ANALYTICAL_TABLE_TYPE = ____adp_quick_actions_control_types["ANALYTICAL_TABLE_TYPE"];
  const GRID_TABLE_TYPE = ____adp_quick_actions_control_types["GRID_TABLE_TYPE"];
  const MDC_TABLE_TYPE = ____adp_quick_actions_control_types["MDC_TABLE_TYPE"];
  const TREE_TABLE_TYPE = ____adp_quick_actions_control_types["TREE_TABLE_TYPE"];
  function getAddXMLAdditionalInfo(change, appComponent) {
    const selector = change.getSelector();
    const targetAggregation = change.getContent()?.targetAggregation ?? '';
    const targetControl = getControlBySelector(selector, appComponent);
    const controlType = targetControl?.getMetadata().getName() ?? '';
    const templateName = getFragmentTemplateName(selector, targetAggregation, appComponent);
    const viewName = targetControl ? findViewByControl(targetControl)?.getViewName() ?? '' : '';
    const result = {};
    if (templateName) {
      result.templateName = templateName;
    }
    if (controlType && targetAggregation && viewName) {
      result.targetAggregation = targetAggregation;
      result.controlType = controlType;
      result.viewName = viewName;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  function getFragmentTemplateName(selector, targetAggregation, appComponent) {
    const control = getControlBySelector(selector, appComponent);
    if (!control) {
      return '';
    }
    const controlName = control.getMetadata().getName();
    if (controlName === 'sap.uxap.ObjectPageLayout' && targetAggregation === 'sections') {
      return 'OBJECT_PAGE_CUSTOM_SECTION';
    } else if (isCustomAction(controlName, targetAggregation)) {
      return 'CUSTOM_ACTION';
    } else if (isObjectPageHeaderField(control, controlName, targetAggregation)) {
      return 'OBJECT_PAGE_HEADER_FIELD';
    } else if (targetAggregation === 'columns') {
      switch (controlName) {
        case MDC_TABLE_TYPE:
          return 'V4_MDC_TABLE_COLUMN';
        case TREE_TABLE_TYPE:
        case GRID_TABLE_TYPE:
          return 'GRID_TREE_TABLE_COLUMN';
        case ANALYTICAL_TABLE_TYPE:
          return 'ANALYTICAL_TABLE_COLUMN';
        default:
          return '';
      }
    } else if (controlName === 'sap.ui.mdc.Table' && targetAggregation === 'actions') {
      return 'TABLE_ACTION';
    }
    return '';
  }
  function isCustomAction(controlName, targetAggregation) {
    if (['sap.f.DynamicPageTitle', 'sap.uxap.ObjectPageHeader', 'sap.uxap.ObjectPageDynamicHeaderTitle'].includes(controlName)) {
      return targetAggregation === 'actions';
    } else if (controlName === 'sap.m.OverflowToolbar' || controlName === 'sap.m.Toolbar') {
      return targetAggregation === 'content';
    }
    return false;
  }
  function isObjectPageHeaderField(control, controlName, targetAggregation) {
    if (controlName === 'sap.uxap.ObjectPageLayout') {
      return targetAggregation === 'headerContent';
    } else if (controlName === 'sap.m.FlexBox') {
      const parentName = control.getParent()?.getMetadata().getName();
      if (parentName === 'sap.uxap.ObjectPageDynamicHeaderContent' || parentName === 'sap.uxap.ObjectPageLayout') {
        return targetAggregation === 'items';
      }
    }
    return false;
  }
  var __exports = {
    __esModule: true
  };
  __exports.getAddXMLAdditionalInfo = getAddXMLAdditionalInfo;
  __exports.getFragmentTemplateName = getFragmentTemplateName;
  return __exports;
});
//# sourceMappingURL=add-xml-additional-info.js.map