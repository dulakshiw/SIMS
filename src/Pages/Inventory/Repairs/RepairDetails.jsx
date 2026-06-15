import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Badge, PageHeader, Table } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import RepairSubmissionForm from "./RepairSubmissionForm";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const formatRepairStatus = (repair = {}) => {
  const statusKey = String(repair.status || "submitted").toLowerCase();
  if (statusKey === "submitted") return "Submitted";
  if (statusKey === "in_progress") return "In Progress";
  if (statusKey === "completed") return "Completed";
  if (statusKey === "cancelled") return "Cancelled";
  return statusKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveRepairBadgeVariant = (repair = {}) => {
  const statusKey = String(repair.status || "submitted").toLowerCase();
  if (statusKey === "completed") return "completed";
  if (statusKey === "cancelled") return "rejected";
  if (statusKey === "in_progress") return "info";
  return "pending";
};

const RepairDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { repairId, role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);

  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const listPath = role ? `/inventory/repairs/list/${role}` : "/inventory/repairs/list";

  useEffect(() => {
    let isMounted = true;

    const loadRepair = async () => {
      try {
        setLoading(true);
        setLoadError("");
        const response = await fetch(`${API_BASE_URL}/api/item-repairs/${repairId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load repair details.");
        }
        if (isMounted) {
          setRepair(data.repair || null);
        }
      } catch (error) {
        if (isMounted) {
          setRepair(null);
          setLoadError(error.message || "Failed to load repair details.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRepair();
    return () => { isMounted = false; };
  }, [repairId]);

  const handlePrintForm = () => window.print();

  const itemRows = (repair?.items || []).map((item, index) => ({
    no: index + 1,
    itemName: item.itemName || "—",
    itemCode: item.itemCode || "—",
    serialNo: item.serialNo || "—",
    model: item.model || "—",
    quantity: item.quantity ?? 1,
  }));

  const canShowForm = Boolean(
    repair?.faultDescription?.trim()
    && (repair?.contactPersonUserId || repair?.contactPersonName)
    && (repair?.formItems?.length || repair?.items?.length)
  );

  const contactPersonLabel = [
    repair?.contactPersonName,
    repair?.contactPersonExtension ? `(Ext: ${repair.contactPersonExtension})` : "",
  ].filter(Boolean).join(" ");

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={`Repair #${repairId}`}
        subtitle="View repair details and print the official form."
        actions={<Button variant="secondary" onClick={() => navigate(listPath)}>Back to Repairs</Button>}
      />

      <div className="p-6 space-y-6">
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}

        {loading ? (
          <p className="text-sm text-text-light">Loading repair details...</p>
        ) : repair ? (
          <>
            <Card title="Repair Summary" icon="handyman">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <p><span className="text-text-light">Status:</span> <Badge variant={resolveRepairBadgeVariant(repair)}>{formatRepairStatus(repair)}</Badge></p>
                <p><span className="text-text-light">Inventory:</span> {repair.inventory?.name || repair.inventory?.location || "—"}</p>
                <p><span className="text-text-light">Department:</span> {repair.inventory?.department || "—"}</p>
                <p><span className="text-text-light">Submitted Date:</span> {repair.repairDate || "—"}</p>
                <p><span className="text-text-light">Initiated By:</span> {repair.initiatedBy || "—"}</p>
                <p><span className="text-text-light">Contact Person:</span> {contactPersonLabel || "—"}</p>
              </div>
            </Card>

            <Card title="Repair Details" icon="edit_note">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-text-light mb-1">Nature of Damage</p>
                  <p className="whitespace-pre-wrap">{repair.faultDescription || "—"}</p>
                </div>
                {repair.repairNotes ? (
                  <div>
                    <p className="text-text-light mb-1">Additional Notes</p>
                    <p className="whitespace-pre-wrap">{repair.repairNotes}</p>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card title="Items" icon="inventory_2">
              <Table
                columns={[
                  { field: "no", label: "No.", sortable: false },
                  { field: "itemName", label: "Item Name", sortable: true },
                  { field: "itemCode", label: "Item Code", sortable: true },
                  { field: "serialNo", label: "Serial No.", sortable: true },
                  { field: "model", label: "Model", sortable: true },
                  { field: "quantity", label: "Qty", sortable: false },
                ]}
                data={itemRows}
                searchable={false}
                paginated={itemRows.length > 10}
                itemsPerPage={10}
              />
            </Card>

            {canShowForm ? (
              <Card
                title="Equipment Repair Requisition Form"
                icon="description"
                actions={<Button variant="secondary" icon="print" onClick={handlePrintForm}>Print Form</Button>}
              >
                <RepairSubmissionForm
                  inventory={repair.inventory || {}}
                  items={repair.formItems || repair.items || []}
                  repairDate={repair.repairDate}
                  faultDescription={repair.faultDescription}
                  officerName={repair.initiatedBy || repair.inventory?.incharge || "—"}
                  officerMobileNo={repair.officerMobileNo || ""}
                  officerExtensionNo={repair.officerExtensionNo || ""}
                  contactPersonName={repair.contactPersonName || ""}
                  contactPersonExtension={repair.contactPersonExtension || ""}
                  contactPersonLocation={repair.contactPersonLocation || ""}
                />
              </Card>
            ) : (
              <Card title="Equipment Repair Requisition Form" icon="description">
                <p className="text-sm text-text-light">
                  The repair form is unavailable because required details are missing from this record.
                </p>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default RepairDetails;
