"use strict";

sap.ui.define(["sap/ui/core/mvc/Controller", "sap/cux/home/NewsPanel", "sap/base/Log"], function (Controller, NewsPanel, Log) {
  "use strict";

  function __ui5_require_async(path) {
    return new Promise(function (resolve, reject) {
      sap.ui.require([path], function (module) {
        if (!(module && module.__esModule)) {
          module = module === null || !(typeof module === "object" && path.endsWith("/library")) ? {
            default: module
          } : module;
          Object.defineProperty(module, "__esModule", {
            value: true
          });
        }
        resolve(module);
      }, function (err) {
        reject(err);
      });
    });
  }
  /**
   * @namespace open.ux.preview.client.flp.homepage.controller.MyHome
   */
  const MyHomeController = Controller.extend("open.ux.preview.client.flp.homepage.controller.MyHome.MyHomeController", {
    onInit: function _onInit() {
      void this.initializeNewsContainer();
    },
    initializeNewsContainer: async function _initializeNewsContainer() {
      // Determine which NewsContainer to use based on availability
      let NewsContainerClass;
      try {
        NewsContainerClass = (await __ui5_require_async('sap/cux/home/NewsContainer')).default;
      } catch (e) {
        Log.info(e?.message);
        NewsContainerClass = (await __ui5_require_async('sap/cux/home/NewsAndPagesContainer')).default;
      }
      const view = this.getView();
      if (view) {
        const newsContainer = new NewsContainerClass(`${view.getId()}-newsContainer`, {
          content: [new NewsPanel(`${view.getId()}-news`, {
            // eslint-disable-next-line @sap-ux/fiori-tools/sap-no-hardcoded-url
            url: 'https://sapui5untested.int.sap.eu2.hana.ondemand.com/databinding/proxy/https/news.sap.com/feed'
          })]
        }).addStyleClass('homeNewsContainer');
        const page = view.byId('page');
        page?.insertContent(newsContainer, 0);
      }
    }
  });
  return MyHomeController;
});
//# sourceMappingURL=MyHome.controller.js.map