sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
  ],
  function (Controller, MessageToast, MessageBox, Filter, FilterOperator, Fragment, JSONModel) {
    "use strict";

    // ─── OData service base URL ───────────────────────────────────────────────
    const _BASE_URL    = "/sap/opu/odata4/sap/zui_conf_req/srvd/sap/zsd_conf_req/0001/";
    const _FETCH_HDR   = { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" };
    const _ENV_ORDER   = { DEV: 1, QAS: 2, PRD: 3 };

    // ─── Service config per module ────────────────────────────────────────────
    // url    → main config table (bảng chính) — used for the list
    // reqUrl → request items table (bảng req)  — used for dialog change preview
    const _SERVICES = {
      MM: {
        label: "MM Routes",
        url:    "/sap/opu/odata4/sap/zui_mm_route_conf/srvd/sap/zsd_mm_route_conf/0001/MMRouteMain",
        reqUrl: "/sap/opu/odata4/sap/zui_mm_route_conf/srvd/sap/zsd_mm_route_conf/0001/MMRouteConf",
        entityKey: "ItemId",
        keyFields:  ["PlantId", "SendWh", "ReceiveWh"],
        diffFields: [
          { field: "TransMode",   old: "OldTransMode"   },
          { field: "IsAllowed",   old: "OldIsAllowed"   },
          { field: "InspectorId", old: "OldInspectorId" },
        ],
      },
      MMSS: {
        label: "MM Safe Stock",
        url:    "/sap/opu/odata4/sap/zui_mm_safe_stock/srvd/sap/zsd_mm_safe_stock/0001/MMSafeStockMain",
        reqUrl: "/sap/opu/odata4/sap/zui_mm_safe_stock/srvd/sap/zsd_mm_safe_stock/0001/MMSafeStock",
        entityKey: "ItemId",
        keyFields:  ["PlantId", "MatGroup"],
        diffFields: [
          { field: "PlantId",  old: "OldPlantId"  },
          { field: "MatGroup", old: "OldMatGroup" },
          { field: "MinQty",   old: "OldMinQty"   },
        ],
      },
      FI: {
        label: "FI Limit",
        url:    "/sap/opu/odata4/sap/zui_fi_limit_conf/srvd/sap/zsd_fi_limit_conf/0001/ZC_FI_LIMIT_CONF",
        reqUrl: "/sap/opu/odata4/sap/zui_fi_limit_conf/srvd/sap/zsd_fi_limit_conf/0001/ZC_FI_LIMIT_CONF",
        entityKey: "ItemId",
        keyFields:  ["ExpenseType", "GlAccount"],
        diffFields: [
          { field: "ExpenseType", old: "OldExpenseType" },
          { field: "GlAccount",   old: "OldGlAccount"   },
          { field: "AutoApprLim", old: "OldAutoApprLim" },
          { field: "Currency",    old: "OldCurrency"    },
        ],
      },
      SD: {
        label: "SD Price",
        url:    "/sap/opu/odata4/sap/zui_sd_price_conf/srvd/sap/zsd_sd_price_conf/0001/SDPriceMain",
        reqUrl: "/sap/opu/odata4/sap/zui_sd_price_conf/srvd/sap/zsd_sd_price_conf/0001/SDPriceConf",
        entityKey: "ItemId",
        keyFields:  ["BranchId", "CustGroup", "MaterialGrp"],
        diffFields: [
          { field: "MaxDiscount", old: "OldMaxDiscount" },
          { field: "MinOrderVal", old: "OldMinOrderVal" },
          { field: "ApproverGrp", old: "OldApproverGrp" },
          { field: "Currency",    old: "OldCurrency"    },
          { field: "ValidFrom",   old: "OldValidFrom"   },
          { field: "ValidTo",     old: "OldValidTo"     },
        ],
      },
    };

    function _getNextEnv(sEnv) {
      return sEnv === "DEV" ? "QAS" : sEnv === "QAS" ? "PRD" : null;
    }

    function _formatDate(sIso) {
      if (!sIso) return "-";
      try {
        return new Date(sIso).toLocaleDateString("vi-VN", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      } catch (e) { return sIso; }
    }

    return Controller.extend("zgsp26.conf.mng.itadmin.ext.main.Main", {

      // ─── Lifecycle ────────────────────────────────────────────────────────────

      onInit: function () {
        this.getView().setModel(
          new JSONModel({ atDev: 0, atQas: 0, atPrd: 0, total: 0 }),
          "kpi"
        );
        this.getView().setModel(
          new JSONModel({ requests: [] }),
          "vm"
        );
        this._loadRequests();
      },

      // ─── Load + deduplicate requests ─────────────────────────────────────────
      //   Step 1: fetch config items from module tables (approved data).
      //   Step 2: fetch ZC_CONF_REQ_H (no status filter) to get the actual
      //           current EnvId per ReqId — promote creates new header records
      //           but module table records keep the original EnvId.
      //   Override item.EnvId with the highest env found in ZC_CONF_REQ_H so
      //   the journey column reflects the real promote position.

      _loadRequests: async function () {
        const oView = this.getView();
        oView.setBusy(true);

        const sModule = this.byId("moduleFilter").getSelectedKey();
        const oDate   = this.byId("dateFilter");
        const dFrom   = oDate.getDateValue();
        const dTo     = oDate.getSecondDateValue();
        const aModuleKeys = sModule ? [sModule] : Object.keys(_SERVICES);

        try {
          // ── Step 1: module config tables ────────────────────────────────────
          const aFetches = aModuleKeys.map(async function (sKey) {
            const oSvc   = _SERVICES[sKey];
            const aParts = [];
            if (dFrom) aParts.push("CreatedAt ge " + dFrom.toISOString());
            if (dTo)   aParts.push("CreatedAt le " + dTo.toISOString());
            const sFilter = aParts.length ? "&$filter=" + encodeURIComponent(aParts.join(" and ")) : "";
            const sUrl = oSvc.url + "?$top=500" + sFilter;
            try {
              const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
              if (!oResp.ok) return [];
              const aItems = (await oResp.json()).value || [];
              return aItems.map(function (item) {
                const sKeyInfo = oSvc.keyFields
                  .map(function (f) { return item[f] || "-"; }).join(" / ");
                return Object.assign({ ModuleId: sKey, _keyInfo: sKeyInfo }, item);
              });
            } catch (e) {
              console.warn("Fetch " + sKey + " failed:", e);
              return [];
            }
          });

          const aAll = (await Promise.all(aFetches)).reduce(function (acc, a) {
            return acc.concat(a);
          }, []);

          // One representative item per ReqId (keep highest module-table EnvId if exists)
          const oMap = {};
          aAll.forEach(function (item) {
            const existing = oMap[item.ReqId];
            if (!existing || (_ENV_ORDER[item.EnvId] || 0) > (_ENV_ORDER[existing.EnvId] || 0)) {
              oMap[item.ReqId] = item;
            }
          });

          // ── Step 2: ZC_CONF_REQ_H → real current EnvId (no status filter) ─
          if (Object.keys(oMap).length) {
            try {
              const sHdrUrl = _BASE_URL + "ZC_CONF_REQ_H" +
                "?$select=ReqId,EnvId&$top=2000";
              const oHdrResp = await fetch(sHdrUrl, { headers: _FETCH_HDR });
              if (oHdrResp.ok) {
                const aHdrs = (await oHdrResp.json()).value || [];
                // Highest EnvId per ReqId from header table
                const oEnvMap = {};
                aHdrs.forEach(function (h) {
                  if (!oMap[h.ReqId]) return;
                  const cur = oEnvMap[h.ReqId];
                  if (!cur || (_ENV_ORDER[h.EnvId] || 0) > (_ENV_ORDER[cur] || 0)) {
                    oEnvMap[h.ReqId] = h.EnvId;
                  }
                });
                // Override module-table EnvId with the real promote position
                Object.keys(oMap).forEach(function (sReqId) {
                  if (oEnvMap[sReqId]) oMap[sReqId].EnvId = oEnvMap[sReqId];
                });
              }
            } catch (e) {
              console.warn("ZC_CONF_REQ_H env override failed:", e);
            }
          }

          // Chỉ giữ items có ReqId hợp lệ — giống logic list bên dưới
          const aDeduped = Object.values(oMap).filter(function (i) { return !!i.ReqId; });

          // ── KPI: đếm unique ReqId giống list (trước khi apply ENV/search filter) ──
          this.getView().getModel("kpi").setData({
            atDev:  aDeduped.filter(function (i) { return i.EnvId === "DEV"; }).length,
            atQas:  aDeduped.filter(function (i) { return i.EnvId === "QAS"; }).length,
            atPrd:  aDeduped.filter(function (i) { return i.EnvId === "PRD"; }).length,
            total:  aDeduped.length,
          });

          let aResult = aDeduped.slice();

          // Client-side: ENV filter (uses overridden EnvId)
          const sEnv = this.byId("envFilter").getSelectedKey();
          if (sEnv) {
            aResult = aResult.filter(function (i) { return i.EnvId === sEnv; });
          }

          // Client-side: Search
          const sQuery = (this.byId("searchField").getValue() || "").toLowerCase();
          if (sQuery) {
            aResult = aResult.filter(function (i) {
              return (String(i.ReqId     || "")).toLowerCase().includes(sQuery) ||
                     (String(i.CreatedBy || "")).toLowerCase().includes(sQuery) ||
                     (String(i._keyInfo  || "")).toLowerCase().includes(sQuery);
            });
          }

          this.getView().getModel("vm").setProperty("/requests", aResult);
        } catch (e) {
          console.error("_loadRequests failed:", e);
          MessageBox.error("Không thể tải dữ liệu: " + (e.message || e));
        } finally {
          oView.setBusy(false);
        }
      },

      // ─── Filter events ────────────────────────────────────────────────────────

      onFilter: function () {
        this._loadRequests();
      },

      onSearch: function () {
        this._loadRequests();
      },

      onClearFilter: function () {
        this.byId("moduleFilter").setSelectedKey("");
        this.byId("envFilter").setSelectedKey("");
        this.byId("dateFilter").setValue("");
        this.byId("searchField").setValue("");
        this._loadRequests();
      },

      // ─── Row action → open dialog ─────────────────────────────────────────────

      onActionPress: function (oEvent) {
        const oCtx  = oEvent.getSource().getParent().getBindingContext("vm");
        const oItem = oCtx.getObject(); // plain JS object from JSONModel
        this._oCurrentItem = oItem;

        const bIsPromote = oItem.EnvId !== "PRD";
        this._openDetailDialog(oItem, bIsPromote);
      },

      // ─── Detail dialog ────────────────────────────────────────────────────────

      _openDetailDialog: async function (oItem, bIsPromote) {
        const sReqId   = oItem.ReqId;
        const sModule  = oItem.ModuleId;
        const sCurEnv  = oItem.EnvId  || "DEV";
        const sNextEnv = _getNextEnv(sCurEnv) || "—";

        if (!this._oDetailDialog) {
          this._oDetailDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "zgsp26.conf.mng.itadmin.ext.main.fragment.DetailDialog",
            controller: this,
          });
          this._oDetailDialog.setModel(
            new JSONModel({
              reqId: "", module: "", confName: "", by: "", reason: "",
              curEnv: "", nextEnv: "",
              isPromoteMode: false, isRollbackMode: false,
              lines: [], journey: [],
            }),
            "detail"
          );
          this.getView().addDependent(this._oDetailDialog);
        }

        this._oCurrentSvc = _SERVICES[sModule];

        this._oDetailDialog.getModel("detail").setData({
          reqId:    sReqId,
          module:   sModule,
          confName: "-",
          by:       oItem.CreatedBy || "-",
          reason:   "-",
          curEnv:   sCurEnv,
          nextEnv:  sNextEnv,
          isPromoteMode:  !!bIsPromote,
          isRollbackMode: sCurEnv === "PRD",
          lines: [], journey: [],
        });

        this.byId("previewTable").setNoDataText("Loading config changes...");
        this._oDetailDialog.open();

        Promise.all([
          this._fetchConfigLines(sReqId, sModule),
          this._fetchJourney(sReqId, sCurEnv),
          this._fetchReqHeader(sReqId, sCurEnv),
        ]).then(([aLines, aJourney, oHeader]) => {
          const oModel = this._oDetailDialog.getModel("detail");
          oModel.setProperty("/lines",    aLines);
          oModel.setProperty("/journey",  aJourney);
          if (oHeader.ReqTitle)  oModel.setProperty("/confName", oHeader.ReqTitle);
          if (oHeader.Reason)    oModel.setProperty("/reason",   oHeader.Reason);
          if (oHeader.CreatedBy) oModel.setProperty("/by",       oHeader.CreatedBy);
          this.byId("previewTable").setNoDataText(
            aLines.length ? "" : "Không có thay đổi nào."
          );
        }).catch(function (e) { console.error(e); });
      },

      // ─── Promote journey (all envs of same ReqId) ─────────────────────────────

      _fetchJourney: async function (sReqId, sCurrentEnv) {
        const sUrl = _BASE_URL + "ZC_CONF_REQ_H" +
          "?$filter=" + encodeURIComponent("ReqId eq '" + sReqId + "'") +
          "&$select=EnvId,Status,CreatedBy,CreatedAt&$top=10";
        try {
          const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
          if (!oResp.ok) return [];
          const aItems = ((await oResp.json()).value || []);
          aItems.sort((a, b) => (_ENV_ORDER[a.EnvId] || 9) - (_ENV_ORDER[b.EnvId] || 9));
          return aItems.map(function (item) {
            return {
              envId:     item.EnvId || "-",
              status:    item.Status || "-",
              by:        item.CreatedBy || "-",
              at:        _formatDate(item.CreatedAt),
              isCurrent: item.EnvId === sCurrentEnv,
            };
          });
        } catch (e) {
          console.warn("Journey fetch failed:", e);
          return [];
        }
      },

      // ─── Request header (ReqTitle, Reason) from ZC_CONF_REQ_H ────────────────

      _fetchReqHeader: async function (sReqId, sEnvId) {
        const sUrl = _BASE_URL + "ZC_CONF_REQ_H" +
          "?$filter=" + encodeURIComponent("ReqId eq '" + sReqId + "' and EnvId eq '" + sEnvId + "'") +
          "&$select=ReqTitle,Reason,CreatedBy&$top=1";
        try {
          const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
          if (!oResp.ok) return {};
          const aItems = (await oResp.json()).value || [];
          return aItems[0] || {};
        } catch (e) {
          console.warn("_fetchReqHeader failed:", e);
          return {};
        }
      },

      // ─── Config lines ─────────────────────────────────────────────────────────

      _fetchConfigLines: async function (sReqId, sModuleId) {
        const aKeys = sModuleId ? [sModuleId] : Object.keys(_SERVICES);
        for (const sKey of aKeys) {
          const oSvc = _SERVICES[sKey];
          if (!oSvc) continue;
          try {
            const oResp = await fetch(oSvc.reqUrl + "?$filter=" + encodeURIComponent("ReqId eq '" + sReqId + "'"), { headers: _FETCH_HDR });
            if (!oResp.ok) continue;
            const aItems = ((await oResp.json()).value || []);
            if (!aItems.length) continue;
            this._oCurrentSvc = oSvc;
            return this._normalizeLines(aItems, oSvc);
          } catch (e) {
            console.warn("Service " + sKey + " failed:", e);
          }
        }
        return [];
      },

      _normalizeLines: function (aItems, oSvc) {
        const aRows = [];
        aItems.forEach(function (oItem) {
          const sKeyInfo = oSvc.keyFields
            .map(function (f) { return f + ": " + (oItem[f] || "-"); })
            .join(" | ");
          oSvc.diffFields.forEach(function (d) {
            const sOld = oItem[d.old]   != null ? String(oItem[d.old])   : "";
            const sNew = oItem[d.field]  != null ? String(oItem[d.field]) : "";
            aRows.push({
              keyInfo: sKeyInfo, field: d.field,
              oldVal: sOld, newVal: sNew,
              changed: sOld !== sNew,
              entityPath: oSvc.reqUrl + "(" + oSvc.entityKey + "=" + oItem[oSvc.entityKey] + ",IsActiveEntity=true)",
            });
          });
        });
        return aRows;
      },

      // ─── Get OData V4 context for a specific (ReqId, EnvId) ──────────────────
      //   Used to execute bound actions (promote / rollback) via OData model.

      _getODataContext: async function (sReqId, sEnvId) {
        const oModel   = this.getView().getModel();
        const oBinding = oModel.bindList("/ZC_CONF_REQ_H", null, null, [
          new Filter("ReqId", FilterOperator.EQ, sReqId),
          new Filter("EnvId", FilterOperator.EQ, sEnvId),
        ]);
        try {
          const aCtx = await oBinding.requestContexts(0, 1);
          return aCtx[0] || null;
        } catch (e) {
          console.error("_getODataContext failed:", e);
          return null;
        }
      },

      // ─── Rollback order validation ────────────────────────────────────────────

      _checkRollbackOrder: async function (sReqId, sCurrentEnv) {
        if (sCurrentEnv === "PRD") return null;
        const aHigher = sCurrentEnv === "DEV" ? ["QAS", "PRD"] : ["PRD"];
        const sFilter = "ReqId eq '" + sReqId + "' and (" +
          aHigher.map(function (e) { return "EnvId eq '" + e + "'"; }).join(" or ") + ")";
        const sUrl = _BASE_URL + "ZC_CONF_REQ_H?$filter=" +
          encodeURIComponent(sFilter) + "&$select=EnvId&$top=3";
        try {
          const oResp = await fetch(sUrl, { headers: _FETCH_HDR });
          if (!oResp.ok) return null;
          const aItems = ((await oResp.json()).value || []);
          if (!aItems.length) return null;
          for (const sEnv of (sCurrentEnv === "DEV" ? ["PRD", "QAS"] : ["PRD"])) {
            if (aItems.some(function (i) { return i.EnvId === sEnv; })) return sEnv;
          }
          return aItems[0].EnvId;
        } catch (e) {
          console.warn("Rollback order check failed:", e);
          return null;
        }
      },

      // ─── Dialog: Rollback ─────────────────────────────────────────────────────

      onDialogRollback: async function () {
        const oItem  = this._oCurrentItem;
        const sReqId = oItem.ReqId;
        const sEnvId = oItem.EnvId || "DEV";

        const oView = this.getView();
        oView.setBusy(true);
        const sBlockingEnv = await this._checkRollbackOrder(sReqId, sEnvId);
        oView.setBusy(false);

        if (sBlockingEnv) {
          MessageBox.warning(
            "Không thể rollback " + sEnvId + " lúc này!\n\n" +
            "Môi trường " + sBlockingEnv + " vẫn đang APPROVED với cùng request.\n" +
            "Phải rollback " + sBlockingEnv + " trước.\n\n" +
            "Thứ tự bắt buộc: PRD → QAS → DEV",
            { title: "Rollback Order Violation", actions: [MessageBox.Action.CLOSE] }
          );
          return;
        }

        MessageBox.confirm(
          "Rollback configuration này?\n" +
          "REQ_ID: " + sReqId + " — ENV: " + sEnvId + "\n\n" +
          "Dữ liệu sẽ được revert về giá trị cũ (OldXxx). Hành động không thể hoàn tác.",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.CANCEL,
            onClose: async (sResult) => {
              if (sResult !== MessageBox.Action.OK) return;
              this._oDetailDialog.close();
              oView.setBusy(true);
              try {
                const oCtx = await this._getODataContext(sReqId, sEnvId);
                if (!oCtx) throw new Error("Không tìm thấy record trên server.");
                await this.getView().getModel().bindContext(
                  "com.sap.gateway.srvd.zsd_conf_req.v0001.rollback(...)", oCtx
                ).execute("$auto");
                this._loadRequests();
                MessageBox.success("Đã rollback thành công — ENV: " + sEnvId + ".");
              } catch (e) {
                console.error(e);
                MessageBox.error("Rollback thất bại: " + (e.message || e));
              } finally {
                oView.setBusy(false);
              }
            },
          }
        );
      },

      // ─── Dialog: Promote ──────────────────────────────────────────────────────

      onDialogPromote: function () {
        const oItem    = this._oCurrentItem;
        const sCurEnv  = oItem.EnvId || "DEV";
        const sNextEnv = _getNextEnv(sCurEnv);

        if (!sNextEnv) {
          MessageBox.warning("Request này đã ở PRD — không thể promote thêm.");
          return;
        }

        MessageBox.confirm(
          "Promote " + sCurEnv + " → " + sNextEnv + "?\n" +
          "REQ_ID: " + oItem.ReqId + "\n\n" +
          "Các dòng cấu hình sẽ được copy sang " + sNextEnv + " với EnvId mới.",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: async (sResult) => {
              if (sResult !== MessageBox.Action.OK) return;
              this._oDetailDialog.close();
              const oView = this.getView();
              oView.setBusy(true);
              try {
                const oCtx = await this._getODataContext(oItem.ReqId, sCurEnv);
                if (!oCtx) throw new Error("Không tìm thấy record trên server.");
                await this.getView().getModel().bindContext(
                  "com.sap.gateway.srvd.zsd_conf_req.v0001.promote(...)", oCtx
                ).execute("$auto");
                this._loadRequests();
                MessageBox.success("Đã promote thành công lên " + sNextEnv + ".");
              } catch (e) {
                console.error(e);
                MessageBox.error("Promote thất bại: " + (e.message || e));
              } finally {
                oView.setBusy(false);
              }
            },
          }
        );
      },

      // ─── Dialog: Close ────────────────────────────────────────────────────────

      onDialogClose: function () {
        this._oDetailDialog.close();
      },

      // ─── Refresh ──────────────────────────────────────────────────────────────

      onRefresh: function () {
        this._loadRequests();
        MessageToast.show("Refreshed");
      },

    });
  }
);
