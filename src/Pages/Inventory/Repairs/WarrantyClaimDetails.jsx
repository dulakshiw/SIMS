import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import { Card, Button, Badge, PageHeader, Table } from "../../../Components/UI";
import { resolveSidebarVariant } from "../../../utils/helpers";
import WarrantyClaimLetterForm from "./WarrantyClaimLetterForm";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const formatClaimStatus = (claim = {}) => {
  const statusKey = String(claim.status || "submitted").toLowerCase();
  if (statusKey === "submitted") return "Letter Submitted";
  if (statusKey === "in_progress") return "In Progress";
  if (statusKey === "completed") return "Completed";
  if (statusKey === "cancelled") return "Cancelled";
  return statusKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveClaimBadgeVariant = (claim = {}) => {
  const statusKey = String(claim.status || "submitted").toLowerCase();
  if (statusKey === "completed") return "completed";
  if (statusKey === "cancelled") return "rejected";
  if (statusKey === "in_progress") return "info";
  return "pending";
};

const WarrantyClaimDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { claimId, role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const listPath = role
    ? `/inventory/repairs/warranty-claims/list/${role}`
    : "/inventory/repairs/warranty-claims/list";

  useEffect(() => {
    let isMounted = true;

    const loadClaim = async () => {
      try {
        setLoading(true);
        setLoadError("");
        const response = await fetch(`${API_BASE_URL}/api/warranty-claims/${claimId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load warranty claim details.");
        }
        if (isMounted) setClaim(data.claim || null);
      } catch (error) {
        if (isMounted) {
          setClaim(null);
          setLoadError(error.message || "Failed to load warranty claim details.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadClaim();
    return () => { isMounted = false; };
  }, [claimId]);

  const handlePrintForm = () => window.print();

  const itemDetailsById = new Map(
    (claim?.formItems || []).map((item) => [String(item.id), item])
  );
  const itemRows = (claim?.items || []).map((item, index) => {
    const details = itemDetailsById.get(String(item.itemId)) || {};
    return {
    no: index + 1,
    itemName: item.itemName || details.itemName || "—",
    itemCode: item.itemCode || details.itemCode || "—",
    serialNo: item.serialNo || details.serialNo || "—",
    model: item.model || details.model || "—",
    warranty: item.warranty || details.warranty || "—",
    purchaseDate: item.purchaseDate || details.purchaseDate || "—",
    supplier: item.supplier || details.supplier || "—",
    ginNo: item.ginNo || details.ginNo || "—",
    quantity: item.quantity ?? 1,
    };
  });

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={`Warranty Claim #${claimId}`}
        subtitle="View warranty claim details and print the letter to Supplies Division."
        actions={<Button variant="secondary" onClick={() => navigate(listPath)}>Back to Warranty Claims</Button>}
      />

      <div className="p-6 space-y-6">
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}

        {loading ? (
          <p className="text-sm text-text-light">Loading warranty claim details...</p>
        ) : claim ? (
          <>
            <Card title="Claim Summary" icon="verified_user">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <p><span className="text-text-light">Status:</span> <Badge label={formatClaimStatus(claim)} variant={resolveClaimBadgeVariant(claim)} /></p>
                <p><span className="text-text-light">Inventory:</span> {claim.inventory?.name || claim.inventory?.location || "—"}</p>
                <p><span className="text-text-light">Claim Date:</span> {claim.claimDate || "—"}</p>
                <p><span className="text-text-light">Initiated By:</span> {claim.initiatedBy || "—"}</p>
                <p className="md:col-span-2"><span className="text-text-light">Fault:</span> {claim.faultDescription || "—"}</p>
                {claim.claimNotes ? (
                  <p className="md:col-span-2"><span className="text-text-light">Notes:</span> {claim.claimNotes}</p>
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
                  { field: "warranty", label: "Warranty", sortable: true },
                  { field: "purchaseDate", label: "Purchase Date", sortable: true },
                  { field: "supplier", label: "Supplier", sortable: true },
                  { field: "ginNo", label: "GIN No.", sortable: true },
                  { field: "quantity", label: "Qty", sortable: false },
                ]}
                data={itemRows}
                searchable={false}
                paginated={itemRows.length > 10}
                itemsPerPage={10}
              />
            </Card>

            <Card
              title="Inform Supplies Division"
              icon="mail"
              actions={<Button variant="secondary" icon="print" onClick={handlePrintForm}>Print Letter</Button>}
            >
              <WarrantyClaimLetterForm
                inventory={claim.inventory || {}}
                items={claim.formItems || claim.items || []}
                claimDate={claim.claimDate}
                faultDescription={claim.faultDescription}
              />
            </Card>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default WarrantyClaimDetails;
