"use strict";

sap.ui.define(["sap/ui/dt/OverlayRegistry", "../../dialog-factory", "../control-types", "../table-quick-action-base", "../dialog-enablement-validator", "../../../utils/fe-v4", "./utils", "../../../utils/version", "../../../utils/core"], function (OverlayRegistry, ____dialog_factory, ___control_types, ___table_quick_action_base, ___dialog_enablement_validator, _____utils_fe_v4, ___utils, _____utils_version, _____utils_core) {
  "use strict";

  const DialogFactory = ____dialog_factory["DialogFactory"];
  const DialogNames = ____dialog_factory["DialogNames"];
  const SMART_TABLE_TYPE = ___control_types["SMART_TABLE_TYPE"];
  const GRID_TABLE_TYPE = ___control_types["GRID_TABLE_TYPE"];
  const MDC_TABLE_TYPE = ___control_types["MDC_TABLE_TYPE"];
  const TREE_TABLE_TYPE = ___control_types["TREE_TABLE_TYPE"];
  const TableQuickActionDefinitionBase = ___table_quick_action_base["TableQuickActionDefinitionBase"];
  const DIALOG_ENABLEMENT_VALIDATOR = ___dialog_enablement_validator["DIALOG_ENABLEMENT_VALIDATOR"];
  const getV4AppComponent = _____utils_fe_v4["getV4AppComponent"];
  const isMacroTable = _____utils_fe_v4["isMacroTable"];
  const getLineItemAnnotation = ___utils["getLineItemAnnotation"];
  const getPropertyPath = ___utils["getPropertyPath"];
  const getUi5Version = _____utils_version["getUi5Version"];
  const isLowerThanMinimalUi5Version = _____utils_version["isLowerThanMinimalUi5Version"];
  const isA = _____utils_core["isA"];
  const CREATE_TABLE_CUSTOM_COLUMN = 'create-table-custom-column';
  const regexForAnnotationPath = /controlConfiguration\/(?:entity\/)?@com\.sap\.vocabularies\.UI\.v1\.LineItem(?:#[^/]+)?\/columns\//;
  const CONTROL_TYPES = [SMART_TABLE_TYPE, MDC_TABLE_TYPE, TREE_TABLE_TYPE, GRID_TABLE_TYPE];
  class AddTableCustomColumnQuickAction extends TableQuickActionDefinitionBase {
    constructor(context) {
      super(CREATE_TABLE_CUSTOM_COLUMN, CONTROL_TYPES, 'QUICK_ACTION_ADD_CUSTOM_TABLE_COLUMN', context, {
        validateTableColumns: true
      }, [DIALOG_ENABLEMENT_VALIDATOR]);
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
      if (!table) {
        return [];
      }
      if (table) {
        const overlay = OverlayRegistry.getOverlay(table) || [];
        const propertyPath = `${getPropertyPath(table, 'columns')}`;
        const anchor = findAnchor(table);
        await DialogFactory.createDialog(overlay, this.context.rta, DialogNames.ADD_CUSTOM_FRAGMENT, undefined, {
          title: 'QUICK_ACTION_ADD_CUSTOM_TABLE_COLUMN',
          type: 'tableColumn',
          appDescriptor: {
            appComponent: getV4AppComponent(this.context.view),
            appType: 'fe-v4',
            pageId: this.pageId,
            projectId: this.context.flexSettings.projectId,
            anchor
          },
          validateId: columnId => {
            const customColumnInPending = [...this.context.changeService.getAllPendingConfigPropertyPath()].filter(path => regexForAnnotationPath.test(path));
            const idInPendingChanges = customColumnInPending.includes(`${propertyPath}${columnId}`);
            if (idInPendingChanges) {
              return false;
            }
            if (isA(MDC_TABLE_TYPE, table) && table.getColumns().every(col => !col.getId().endsWith(`CustomColumn::${columnId}`))) {
              return true;
            }
            return false;
          },
          propertyPath
        }, {
          actionName: this.type,
          telemetryEventIdentifier: this.getTelemetryIdentifier()
        });
      }
      return [];
    }
  }
  function findAnchor(table) {
    const macroTable = table.getParent();
    let anchor = '';
    if (isMacroTable(macroTable)) {
      let metaPath = '';
      if (macroTable.metaPath.includes('LineItem')) {
        metaPath = macroTable.metaPath;
      } else {
        const segments = macroTable.metaPath.split('/');
        segments.pop();
        const path = segments.join('/');
        metaPath = `${path}/${getLineItemAnnotation(macroTable)}`;
      }
      if (!metaPath) {
        return '';
      }
      const columns = macroTable.getModel()?.getMetaModel()?.getObject(metaPath);
      const filteredColumns = columns.filter(col => ['com.sap.vocabularies.UI.v1.DataField', 'com.sap.vocabularies.UI.v1.DataFieldForIntentBasedNavigation', 'com.sap.vocabularies.UI.v1.DataFieldForAnnotation'].includes(col.$Type) || 'com.sap.vocabularies.UI.v1.DataFieldForAction' === col.$Type && col.Inline);
      const lastColumn = filteredColumns.at(-1);
      if (!lastColumn) {
        return '';
      }
      anchor = buildColumnAnchor(lastColumn);
    }
    return anchor;
  }

  /**
   * Builds anchor string for different column types
   * @param column - The column object from metadata
   * @returns The anchor string for the column
   */
  function buildColumnAnchor(column) {
    if (column.$Type === 'com.sap.vocabularies.UI.v1.DataFieldForAction') {
      return `DataFieldForAction::${column.Action}`;
    }
    if (column.$Type === 'com.sap.vocabularies.UI.v1.DataField') {
      return `DataField::${column.Value?.$Path}`;
    }
    if (column.$Type === 'com.sap.vocabularies.UI.v1.DataFieldForIntentBasedNavigation') {
      return `DataFieldForIntentBasedNavigation::${column.SemanticObject}::${column.Action}`;
    }
    if (column.$Type === 'com.sap.vocabularies.UI.v1.DataFieldForAnnotation') {
      const annotationPath = column.Target?.$AnnotationPath;
      if (!annotationPath) {
        return '';
      }
      const annotation = annotationPath.split('.').pop();
      return `DataFieldForAnnotation::${annotation?.split('#').join('::')}`;
    }
    return '';
  }
  var __exports = {
    __esModule: true
  };
  __exports.CREATE_TABLE_CUSTOM_COLUMN = CREATE_TABLE_CUSTOM_COLUMN;
  __exports.CONTROL_TYPES = CONTROL_TYPES;
  __exports.AddTableCustomColumnQuickAction = AddTableCustomColumnQuickAction;
  return __exports;
});
//# sourceMappingURL=create-table-custom-column-config-change.js.map