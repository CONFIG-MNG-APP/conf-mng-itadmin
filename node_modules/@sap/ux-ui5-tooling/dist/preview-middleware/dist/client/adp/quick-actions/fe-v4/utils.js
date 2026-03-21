"use strict";

sap.ui.define(["../../../utils/core", "sap/ui/rta/command/CommandFactory", "../../../utils/fe-v4"], function (_____utils_core, CommandFactory, _____utils_fe_v4) {
  "use strict";

  const getControlById = _____utils_core["getControlById"];
  const getV4AppComponent = _____utils_fe_v4["getV4AppComponent"];
  const getPageName = _____utils_fe_v4["getPageName"];
  const getReference = _____utils_fe_v4["getReference"];
  const isMacroTable = _____utils_fe_v4["isMacroTable"];
  async function executeToggleAction(context, isButtonEnabled, controlType, propertyPath) {
    const controls = context.controlIndex[controlType] ?? [];
    const control = controls[0];
    if (control) {
      const modifiedControl = getControlById(control.controlId);
      if (!modifiedControl) {
        return [];
      }
      const {
        flexSettings
      } = context;
      const parent = modifiedControl.getParent();
      if (!parent) {
        return [];
      }
      const modifiedValue = {
        reference: getReference(modifiedControl),
        appComponent: getV4AppComponent(modifiedControl),
        changeType: 'appdescr_fe_changePageConfiguration',
        parameters: {
          page: getPageName(parent),
          entityPropertyChange: {
            propertyPath: propertyPath,
            propertyValue: !isButtonEnabled,
            operation: 'UPSERT'
          }
        }
      };
      const command = await CommandFactory.getCommandFor(modifiedControl, 'appDescriptor', modifiedValue, null, flexSettings);
      return [command];
    }
    return [];
  }
  const PATTERN_SUFFIX = ':?query:';

  /**
   * Generates the pattern for a new route based on the input.
   *
   * @param sourceRoutePattern source page route pattern
   * @param navProperty navigation property name (used to build nav pattern for nested OP )
   * @param targetEntitySet navigation target entity set
   * @returns the generated pattern as string
   */
  function generateRoutePattern(sourceRoutePattern, navProperty, targetEntitySet) {
    const parts = [];
    const basePattern = sourceRoutePattern.replace(PATTERN_SUFFIX, '');
    if (basePattern) {
      parts.push(basePattern);
      parts.push('/');
      parts.push(navProperty);
    } else {
      parts.push(targetEntitySet);
    }
    parts.push(`({${targetEntitySet}Key})`);
    parts.push(PATTERN_SUFFIX);
    return parts.join('');
  }

  /**
   * Get LineItem annotation - tries to use design-time helper if available, falls back to local implementation.
   *
   * @param table - table control
   * @returns LineItem annotation string
   */
  function getLineItemAnnotation(table) {
    try {
      const helper = sap.ui.require('sap/fe/macros/table/designtime/Table.designtime.helper');
      if (helper && typeof helper.getLineItemAnnotation === 'function') {
        return helper.getLineItemAnnotation(table);
      }
    } catch {
      // Module not available or error occurred
    }
    return getLineItemAnnotationForTable(table);
  }

  /**
   * Get property path for table action.
   *
   * @param table - table control
   * @returns string
   */
  function getPropertyPath(table, property = 'actions') {
    const macroTable = table.getParent();
    const configPath = '';
    if (isMacroTable(macroTable)) {
      const lineItemAnnotation = getLineItemAnnotation(macroTable);
      const navigationPath = macroTable.metaPath.split(macroTable.getProperty('contextPath'))[1];
      if (!lineItemAnnotation) {
        throw new Error('Line item annotation could not be determined for the table.');
      }
      if (navigationPath) {
        return configPath.concat('controlConfiguration/', navigationPath.split('@')[0], lineItemAnnotation, `/${property}/`);
      } else {
        let contextString = macroTable.metaPath;
        const firstSlash = contextString.indexOf('/');
        if (firstSlash >= 0) {
          contextString = contextString.substring(firstSlash + 1);
        }
        const secondSlash = contextString.indexOf('/');
        if (secondSlash >= 0) {
          contextString = contextString.substring(0, secondSlash);
        }
        return configPath.concat('controlConfiguration/', '/', contextString, '/', lineItemAnnotation, `/${property}/`);
      }
    }
    return undefined;
  }

  /**
   * Return the line item annotation that defines the table.
   * This may come from a Presentation Variant, a Selection Presentation Variant or the default.
   * @param table - The table control
   * @returns The line item annotation used to define the table
   */
  function getLineItemAnnotationForTable(macroTable) {
    let lineItemAnnotation = '';
    if (isMacroTable(macroTable)) {
      const presentation = macroTable.getModel()?.getMetaModel()?.getObject(macroTable.metaPath);

      // default line item annotation
      if (!presentation.Visualizations && !presentation.PresentationVariant) {
        lineItemAnnotation = macroTable.metaPath.split('/').pop();
      } else if (presentation.Visualizations) {
        lineItemAnnotation = presentation.Visualizations[0].$AnnotationPath;
      } else if (presentation.PresentationVariant) {
        if (presentation.PresentationVariant.Visualizations) {
          lineItemAnnotation = presentation.PresentationVariant.Visualizations[0].$AnnotationPath;
        } else {
          const contextPath = macroTable.metaPath.startsWith('/') ? macroTable.metaPath.split('@')[0] : macroTable.contextPath;
          const pathForLineItems = contextPath + presentation.PresentationVariant.$Path;
          const presentationVariantType = macroTable.getModel()?.getMetaModel()?.getObject(pathForLineItems);
          lineItemAnnotation = presentationVariantType.Visualizations[0].$AnnotationPath;
        }
      }
    }
    return lineItemAnnotation;
  }
  var __exports = {
    __esModule: true
  };
  __exports.executeToggleAction = executeToggleAction;
  __exports.generateRoutePattern = generateRoutePattern;
  __exports.getLineItemAnnotation = getLineItemAnnotation;
  __exports.getPropertyPath = getPropertyPath;
  return __exports;
});
//# sourceMappingURL=utils.js.map