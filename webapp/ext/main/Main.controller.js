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

    // ─── Service config per module ─────────────────────────────────────────
    const _SERVICES = {
      MM: {
        label: "MM Routes",
        url: "/sap/opu/odata4/sap/zui_mm_route_conf/srvd/sap/zsd_mm_route_conf/0001/MMRouteConf",
        entityKey: "ItemId",      // OData primary key field (Edm.Guid)
        keyFields:  ["PlantId", "SendWh", "ReceiveWh"],   // display-only
        diffFields: [
          { field: "TransMode",   old: "OldTransMode"   },
          { field: "IsAllowed",   old: "OldIsAllowed"   },
          { field: "InspectorId", old: "OldInspectorId" },
        ],
      },
      MMSS: {
        label: "MM Safe Stock",
        url: "/sap/opu/odata4/sap/zui_mm_safe_stock/srvd/sap/zsd_mm_safe_stock/0001/MMSafeStock",
        entityKey: "ItemId",
        keyFields:  ["Material", "Plant"],
        diffFields: [
          { field: "SafetyStock",  old: "OldSafetyStock"  },
          { field: "ReorderPoint", old: "OldReorderPoint" },
          { field: "MinLotSize",   old: "OldMinLotSize"   },
        ],
      },
      FI: {
        label: "FI Limit",
        url: "/sap/opu/odata4/sap/zui_fi_limit_conf/srvd/sap/zsd_fi_limit_conf/0001/FILimitConf",
        entityKey: "ItemId",
        keyFields:  ["CostCenter", "GLAccount"],
        diffFields: [
          { field: "LimitAmount", old: "OldLimitAmount" },
          { field: "Currency",    old: "OldCurrency"    },
          { field: "ValidFrom",   old: "OldValidFrom"   },
          { field: "ValidTo",     old: "OldValidTo"     },
        ],
      },
      SD: {
        label: "SD Price",
        url: "/sap/opu/odata4/sap/zui_sd_price_conf/srvd/sap/zsd_sd_price_conf/0001/SDPriceConf",
        entityKey: "ItemId",
        keyFields:  ["Material", "SalesOrg"],
        diffFields: [
          { field: "Price",     old: "OldPrice"     },
          { field: "Currency",  old: "OldCurrency"  },
          { field: "ValidFrom", old: "OldValidFrom" },
          { field: "ValidTo",   old: "OldValidTo"   },
        ],
      },
    };

    function _getNextEnv(sEnv) {
      return sEnv === "DEV" ? "QAS" : sEnv === "QAS" ? "PRD" : null;
    }

    return Controller.extend("zgsp26.conf.mng.itadmin.ext.main.Main", {

      // ─── Filter ───────────────────────────────────────────────────────────

      onFilter: function () {
        this._applyFilter();
      },

      onSearch: function (oEvent) {
        const sQuery = oEvent.getParameter("query") || "";
        const aFilters = this._buildFilters();
        if (sQuery) {
          aFilters.push(new Filter({
            filters: [
              new Filter("ReqId",     FilterOperator.Contains, sQuery),
              new Filter("ReqTitle",  FilterOperator.Contains, sQuery),
              new Filter("CreatedBy", FilterOperator.Contains, sQuery),
            ],
            and: false,
          }));
        }
        this.byId("requestTable").getBinding("items").filter(aFilters);
      },

      onClearFilter: function () {
        this.byId("moduleFilter").setSelectedKey("");
        this.byId("envFilter").setSelectedKey("");
        this.byId("dateFilter").setValue("");
        this.byId("searchField").setValue("");
        this.byId("requestTable").getBinding("items").filter([
          new Filter("Status", FilterOperator.EQ, "APPROVED"),
        ]);
      },

      _buildFilters: function () {
        const sModule = this.byId("moduleFilter").getSelectedKey();
        const sEnv    = this.byId("envFilter").getSelectedKey();
        const oDate   = this.byId("dateFilter");
        const aFilters = [];
        if (sModule) aFilters.push(new Filter("ModuleId", FilterOperator.EQ, sModule));
        if (sEnv)    aFilters.push(new Filter("EnvId",    FilterOperator.EQ, sEnv));
        const dFrom = oDate.getDateValue();
        const dTo   = oDate.getSecondDateValue();
        if (dFrom) aFilters.push(new Filter("CreatedAt", FilterOperator.GE, dFrom));
        if (dTo)   aFilters.push(new Filter("CreatedAt", FilterOperator.LE, dTo));
        return aFilters;
      },

      _applyFilter: function () {
        this.byId("requestTable").getBinding("items").filter(this._buildFilters());
      },

      // ─── Action button per row ([Apply] or [View]) ────────────────────────

      onActionPress: function (oEvent) {
        const oItem = oEvent.getSource().getParent();
        const oCtx  = oItem.getBindingContext();
        this._oCurrentCtx = oCtx;

        const sStatus  = oCtx.getProperty("Status");
        const bIsApply = sStatus === "APPROVED" || sStatus === "A";
        this._openDetailDialog(oCtx, bIsApply);
      },

      // ─── Open dialog ──────────────────────────────────────────────────────

      _openDetailDialog: async function (oCtx, bIsApply) {
        const sReqId   = oCtx.getProperty("ReqId");
        const sModule  = oCtx.getProperty("ModuleId");
        const sTitle   = oCtx.getProperty("ReqTitle") || "-";
        const sBy      = oCtx.getProperty("CreatedBy") || "-";
        const sReason  = oCtx.getProperty("Reason") || "-";
        const sCurEnv  = oCtx.getProperty("EnvId") || "DEV";
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
              nextEnv: "", isApplyMode: true,
              lines: [], editableLines: [],
            }),
            "detail"
          );
          this.getView().addDependent(this._oDetailDialog);
        }

        // Store service ref for Apply/Promote actions
        this._oCurrentSvc = _SERVICES[sModule];

        const oModel = this._oDetailDialog.getModel("detail");
        oModel.setData({
          reqId: sReqId, module: sModule, confName: sTitle,
          by: sBy, reason: sReason, nextEnv: sNextEnv,
          isApplyMode: bIsApply,
          lines: [], editableLines: [],
        });

        this.byId("previewTable").setNoDataText("Loading config changes...");
        this._oDetailDialog.open();

        this._fetchConfigLines(sReqId, sModule, sCurEnv, sNextEnv).then((aLines) => {
          oModel.setProperty("/lines", aLines);
          // Editable table: only rows with actual changes
          oModel.setProperty("/editableLines",
            aLines.filter(function (r) { return r.changed; })
          );
          this.byId("previewTable").setNoDataText(
            aLines.length ? "" : "Không có thay đổi nào."
          );
        }).catch(function (e) {
          console.error(e);
        });
      },

      // ─── Fetch & normalize config lines ──────────────────────────────────

      _fetchConfigLines: async function (sReqId, sModuleId) {
        const aKeys = sModuleId ? [sModuleId] : Object.keys(_SERVICES);

        for (const sKey of aKeys) {
          const oSvc = _SERVICES[sKey];
          if (!oSvc) continue;
          try {
            const sUrl = oSvc.url + "?$filter=ReqId eq " + sReqId;
            const oResp = await fetch(sUrl, {
              headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" },
            });
            if (!oResp.ok) continue;
            const oData = await oResp.json();
            const aItems = oData.value || [];
            if (!aItems.length) continue;
            // Store service ref for later use in Apply
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
          // Build OData V4 entity path for PATCH: url(ItemId=guid,IsActiveEntity=true)
          const sEntityPath = oSvc.url + "(" + oSvc.entityKey + "=" + oItem[oSvc.entityKey] + ",IsActiveEntity=true)";
          const sKeyInfo = oSvc.keyFields
            .map(function (f) { return f + ": " + (oItem[f] || "-"); })
            .join(" | ");

          oSvc.diffFields.forEach(function (d) {
            const sOldVal = oItem[d.old]   != null ? String(oItem[d.old])   : "";
            const sNewVal = oItem[d.field]  != null ? String(oItem[d.field]) : "";
            aRows.push({
              keyInfo:    sKeyInfo,
              field:      d.field,
              oldVal:     sOldVal,
              newVal:     sNewVal,
              changed:    sOldVal !== sNewVal,
              entityPath: sEntityPath,    // needed for PATCH in Apply
            });
          });
        });
        return aRows;
      },

      // ─── Dialog: Apply (gọi backend action apply → lưu vào bảng chính) ────

      onDialogApply: function () {
        const sReqId = this._oCurrentCtx.getProperty("ReqId");

        MessageBox.confirm(
          "Apply configuration này vào bảng chính?\n" +
          "REQ_ID: " + sReqId + "\n" +
          "Dữ liệu thay đổi sẽ được ghi vào bảng cấu hình chính.",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: async (sResult) => {
              if (sResult !== MessageBox.Action.OK) return;

              this._oDetailDialog.close();
              const oView = this.getView();
              oView.setBusy(true);
              try {
                await this._oCurrentCtx.getModel().bindContext(
                  "com.sap.gateway.srvd.zsd_conf_req.v0001.apply(...)",
                  this._oCurrentCtx
                ).execute("$auto");
                this.byId("requestTable").getBinding("items").refresh();
                MessageBox.success("Đã apply thành công vào bảng chính.");
              } catch (e) {
                console.error(e);
                MessageBox.error(
                  "Apply thất bại.\n" +
                  "Lưu ý: Backend cần khai báo action 'apply' trong BDEF.\n" +
                  "Chi tiết: " + (e.message || e)
                );
              } finally {
                oView.setBusy(false);
              }
            },
          }
        );
      },

      // ─── Dialog: Promote (copy dòng mới với EnvId = nextEnv) ────────────

      onDialogPromote: function () {
        const sCurEnv  = this._oCurrentCtx.getProperty("EnvId") || "DEV";
        const sNextEnv = _getNextEnv(sCurEnv);

        if (!sNextEnv) {
          MessageBox.warning("Request này đã ở PRD — không thể promote thêm.");
          return;
        }

        const sReqId  = this._oCurrentCtx.getProperty("ReqId");
        const sModule = this._oCurrentCtx.getProperty("ModuleId");

        MessageBox.confirm(
          "Promote " + sCurEnv + " → " + sNextEnv + "?\n" +
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
                await this._promoteConfigItems(sReqId, sModule, sCurEnv, sNextEnv);
                this.byId("requestTable").getBinding("items").refresh();
                MessageBox.success(
                  "Đã promote thành công lên " + sNextEnv + "."
                );
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

      // ─── Promote: fetch items → POST dòng mới với EnvId = nextEnv ─────────

      _promoteConfigItems: async function (sReqId, sModule, sCurEnv, sNextEnv) {
        const oSvc = _SERVICES[sModule] || this._oCurrentSvc;
        if (!oSvc) throw new Error("Không tìm thấy service cho module: " + sModule);

        // 1. Fetch config items của request hiện tại
        const sFilterUrl = oSvc.url +
          "?$filter=ReqId eq " + sReqId +
          " and EnvId eq '" + sCurEnv + "'";

        const oFetchResp = await fetch(sFilterUrl, {
          headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" },
        });
        if (!oFetchResp.ok) {
          throw new Error("Lấy config items thất bại (" + oFetchResp.status + ")");
        }
        const oData  = await oFetchResp.json();
        const aItems = oData.value || [];

        if (!aItems.length) {
          throw new Error("Không có config item nào cho " + sCurEnv + " - ReqId: " + sReqId);
        }

        // 2. Fetch CSRF token
        const sCsrf = await this._fetchCsrfToken(oSvc.url);

        // 3. POST từng dòng mới, chỉ giữ business fields, đổi EnvId = nextEnv
        const _SYSTEM_FIELDS = new Set([
          "ItemId", "IsActiveEntity", "HasDraftEntity", "HasActiveEntity",
          "DraftEntityCreationDateTime", "DraftEntityLastChangeDateTime",
          "CreatedBy", "CreatedAt", "ChangedBy", "ChangedAt",
          "__EntityControl", "__OperationControl", "SAP__Messages",
        ]);

        for (const oItem of aItems) {
          const oNewItem = {};
          Object.keys(oItem).forEach(function (k) {
            if (!_SYSTEM_FIELDS.has(k) && typeof oItem[k] !== "object") {
              oNewItem[k] = oItem[k];
            }
          });
          oNewItem.EnvId = sNextEnv;   // đổi sang môi trường mới

          const oPostResp = await fetch(oSvc.url, {
            method: "POST",
            headers: {
              "Content-Type":     "application/json",
              "Accept":           "application/json",
              "X-CSRF-Token":     sCsrf,
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify(oNewItem),
          });

          if (!oPostResp.ok) {
            const sErr = await oPostResp.text().catch(function () { return ""; });
            throw new Error(
              "POST thất bại (" + oPostResp.status + ")" +
              (sErr ? ": " + sErr.substring(0, 200) : "")
            );
          }
        }
      },

      // ─── CSRF token helper ────────────────────────────────────────────────

      _fetchCsrfToken: async function (sServiceUrl) {
        const oResp = await fetch(sServiceUrl, {
          method: "HEAD",
          headers: {
            "X-CSRF-Token":     "Fetch",
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        const sToken = oResp.headers.get("X-CSRF-Token");
        if (!sToken || sToken === "Required") {
          throw new Error("Không lấy được CSRF token");
        }
        return sToken;
      },

      // ─── Dialog: Close ────────────────────────────────────────────────────

      onDialogClose: function () {
        this._oDetailDialog.close();
      },

      // ─── Refresh ──────────────────────────────────────────────────────────

      onRefresh: function () {
        this.byId("requestTable").getBinding("items").refresh();
        MessageToast.show("Refreshed");
      },

    });
  }
);
