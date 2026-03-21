"use strict";

sap.ui.define(["sap/ui/core/Component", "sap/ui/core/Element", "sap/ui/core/util/reflection/JsControlTreeModifier", "sap/base/Log", "./error"], function (Component, Element, JsControlTreeModifier, Log, ___error) {
  "use strict";

  const getError = ___error["getError"];
  /**
   * Gets Component by id.
   *
   * @param id - unique identifier for control
   * @returns Component | undefined
   */
  function getComponent(id) {
    if (Component?.getComponentById) {
      return Component.getComponentById(id);
    } else if (Component?.get) {
      // Older version must be still supported until maintenance period.
      return Component.get(id); // NOSONAR
    } else {
      // Older version must be still supported until maintenance period.
      return sap.ui.getCore().getComponent(id); // NOSONAR
    }
  }

  /**
   * Returns control by its global ID.
   *
   * @param id Id of the control.
   * @returns Control instance if it exists.
   */
  function getControlById(id) {
    if (typeof Element.getElementById === 'function') {
      return Element.getElementById(id);
    } else {
      return sap.ui.getCore().byId(id);
    }
  }

  /**
   * Gets target control by trying getControlById first, then falling back to JsControlTreeModifier.bySelector
   * for projects where the control may not be found by global ID.
   *
   * @param selector - The selector object from the change.
   * @param appComponent - The app component (optional).
   * @returns The target control element or undefined.
   */
  function getControlBySelector(selector, appComponent) {
    if (!selector?.id) {
      return undefined;
    }
    let control = getControlById(selector.id);
    if (!control && appComponent && selector) {
      try {
        control = JsControlTreeModifier.bySelector(selector, appComponent);
      } catch (error) {
        Log.warning('Failed to get control by selector:', getError(error));
      }
    }
    return control;
  }

  /**
   * Checks wether this object is an instance of a ManagedObject.
   *
   * @param element An object.
   * @returns True if element is an instance of a ManagedObject.
   */
  function isManagedObject(element) {
    if (typeof element?.isA === 'function') {
      return element.isA('sap.ui.base.ManagedObject');
    }
    return false;
  }

  /**
   * Checks whether this object is an instance of the named type.
   *
   * @param type - Type to check for.
   * @param element - Object to check
   * @returns Whether this object is an instance of the given type.
   */
  function isA(type, element) {
    return !!element?.isA(type);
  }
  function hasParent(component, parentIdToFind) {
    const parent = component.getParent();
    if (!parent) {
      return false;
    }
    if (parent.getId() === parentIdToFind) {
      return true;
    }
    return hasParent(parent, parentIdToFind);
  }

  /**
   * Utility function to safely call getParent on UI5 elements
   * @param element UI5 element
   * @returns parent element or null
   */
  function getElementParent(element) {
    if (typeof element.getParent === 'function') {
      return element.getParent();
    }
    return null;
  }

  /**
   * Finds the view that contains the given control.
   *
   * @param control - Control instance  
   * @returns View instance if found, undefined otherwise
   */
  function findViewByControl(control) {
    if (!control) {
      return undefined;
    }
    if (isA('sap.ui.core.mvc.View', control)) {
      return control;
    }
    const parent = getElementParent(control);
    if (!parent) {
      return undefined;
    }
    return findViewByControl(parent);
  }
  function findNestedElements(ownerElement, candidates) {
    const ownerId = ownerElement.getId();
    return candidates.filter(item => hasParent(item, ownerId));
  }
  var __exports = {
    __esModule: true
  };
  __exports.getComponent = getComponent;
  __exports.getControlById = getControlById;
  __exports.getControlBySelector = getControlBySelector;
  __exports.isManagedObject = isManagedObject;
  __exports.isA = isA;
  __exports.hasParent = hasParent;
  __exports.findViewByControl = findViewByControl;
  __exports.findNestedElements = findNestedElements;
  return __exports;
});
//# sourceMappingURL=core.js.map