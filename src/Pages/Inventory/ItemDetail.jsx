import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, PageHeader, Badge } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";
import { ITEM_STATUS } from "../../utils/constants";
import "../../Styles/ItemDetail.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const SYSTEM_HEADER_TITLE =
  "Inventory Management System - Faculty of Information Technology";

const resolveUploadUrl = (filePath) => {
  if (!filePath) {
    return "";
  }
  const normalized = String(filePath).trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  const uploadsIndex = normalized.toLowerCase().indexOf("/uploads/");
  const relativePath = uploadsIndex >= 0 ? normalized.slice(uploadsIndex) : normalized;
  return `${API_BASE_URL}${relativePath.startsWith("/") ? relativePath : `/${relativePath}`}`;
};

const pickField = (item, ...keys) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
};

const formatDisplayValue = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "-";
  }
  return String(value);
};

const formatRupee = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "-";
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "-";
  }
  return `Rs. ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toISOString().split("T")[0];
};

const getQrImageUrl = (value, size = 200) => {
  if (!value) {
    return null;
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
};

const buildQrScanUrl = (payload, incharge = "") => {
  if (!payload) {
    return "";
  }
  if (/^https?:\/\//i.test(payload)) {
    return payload;
  }
  const params = new URLSearchParams({ q: payload });
  if (incharge) {
    params.set("incharge", incharge);
  }
  return `${window.location.origin}/inventory/scan?${params.toString()}`;
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("en-LK");
};

const DetailField = ({ label, value, className = "" }) => (
  <div className={`item-detail-field space-y-1 ${className}`.trim()}>
    <p className="text-xs font-semibold uppercase tracking-wide text-text-light">{label}</p>
    <div className="text-sm text-text-dark">{value}</div>
  </div>
);

const ItemDetail = () => {
  const { id, role } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const rolePath = role || sidebarVariant || "incharge";
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [printedAt, setPrintedAt] = useState("");

  const refreshPrintedAt = () => {
    setPrintedAt(new Date().toLocaleString("en-LK"));
  };

  useEffect(() => {
    const onBeforePrint = () => refreshPrintedAt();
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items/${id}`);
        const data = await res.json();
        if (!mounted) {
          return;
        }
        if (res.ok) {
          setItem(data.item);
        } else {
          setItem(null);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setItem(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <MainLayout variant={sidebarVariant}>
        <div className="p-6">Loading...</div>
      </MainLayout>
    );
  }

  if (!item) {
    return (
      <MainLayout variant={sidebarVariant}>
        <div className="p-6">Item not found.</div>
      </MainLayout>
    );
  }

  const itemName = pickField(item, "itemName", "item_name", "name") || "Item Details";
  const itemCode = pickField(item, "itemCode", "item_code", "code");
  const serialNo = pickField(item, "serialNo", "serial_no", "serial");
  const serialNo2 = pickField(item, "serialNo2", "serial_no2");
  const model = pickField(item, "model");
  const pageno = pickField(item, "pageno", "page_no");
  const qrCode = pickField(item, "QRCode", "qr_code", "qrcode");
  const qrCode2 = pickField(item, "QRCode2", "qr_code2", "qrcode2");
  const qrCodeUrl = pickField(item, "qrcodeUrl", "qrcode_url");
  const qrCode2Url = pickField(item, "qrcode2Url", "qrcode2_url");
  const itemImage = pickField(item, "itemImage", "item_image", "itemimage", "image", "image_path");
  const value = pickField(item, "value");
  const purchaseDate = pickField(item, "purchaseDate", "purchase_date", "purchased_date");
  const ginNo = pickField(item, "ginNo", "gin_no");
  const ginfile = pickField(item, "ginfile", "gin_pdf", "gin_file");
  const poNo = pickField(item, "poNo", "po_no");
  const supplier = pickField(item, "supplier");
  const funding = pickField(item, "funding", "funding_source");
  const receivedfrom = pickField(item, "receivedfrom", "received_from");
  const warranty = pickField(item, "warranty");
  const locationValue = pickField(item, "location");
  const status = pickField(item, "status") || "available";
  const remarks = pickField(item, "remarks");
  const inventoryName = pickField(item, "inventoryName", "inventory_name");
  const itemId = item.id ?? item.item_id;
  const createdAt = pickField(item, "created_at", "createdAt");
  const updatedAt = pickField(item, "updated_at", "updatedAt");

  const imageUrl = itemImage ? resolveUploadUrl(itemImage) : "";
  const ginPdfUrl = ginfile ? resolveUploadUrl(ginfile) : "";
  const statusMeta = ITEM_STATUS.find((entry) => entry.value === status);

  const qr1ScanUrl = qrCodeUrl || buildQrScanUrl(qrCode, receivedfrom);
  const qr2ScanUrl = qrCode2Url || buildQrScanUrl(qrCode2, receivedfrom);
  const qr1ImageUrl = qrCode ? getQrImageUrl(qrCode, 180) : null;
  const qr2ImageUrl = qrCode2 ? getQrImageUrl(qrCode2, 180) : null;

  const transferPath = `/inventory/transfers/list?itemId=${itemId}`;
  const disposePath = `/inventory/disposals/new/${rolePath}?itemId=${itemId}&itemName=${encodeURIComponent(itemName)}`;
  const updatePath = `/inventory/add/${rolePath}?editItemId=${itemId}&inventoryId=${pickField(item, "inventory_id", "inventoryId") || ""}`;
  const statusLabel = pickField(item, "statusLabel")
    || (item.locationKind === "place" ? locationValue : null)
    || statusMeta?.label
    || status;
  const storedUser = getStoredUser();
  const isInventoryIncharge = rolePath === "incharge"
    || rolePath === "inventory_incharge"
    || storedUser.role === "inventory_incharge";
  const canReturnItem = isInventoryIncharge && Number(item.issuedRequestId) > 0;

  const handleReturnItem = async () => {
    const returnerUserId = Number(storedUser.id ?? storedUser.user_id ?? storedUser.userId ?? 0);
    if (!Number.isInteger(returnerUserId) || returnerUserId <= 0) {
      setReturnError("Your session is missing a user id. Please sign in again.");
      return;
    }

    if (!window.confirm(`Return ${itemName} to ${inventoryName || "the inventory"}?`)) {
      return;
    }

    try {
      setReturning(true);
      setReturnError("");
      const response = await fetch(`${API_BASE_URL}/api/item-requests/${item.issuedRequestId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnerUserId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to return item.");
      }

      setItem((currentItem) => ({
        ...currentItem,
        status: "available",
        location: data.location || currentItem.inventoryName || currentItem.location,
        statusLabel: data.location || currentItem.inventoryName || currentItem.location,
        locationKind: "place",
        issuedRequestId: null,
      }));
      window.alert(data.message || "Item returned successfully.");
    } catch (error) {
      setReturnError(error.message || "Failed to return item.");
    } finally {
      setReturning(false);
    }
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <div className="no-print">
      <PageHeader
        title={itemName}
        subtitle={`Item ID: ${formatDisplayValue(item.id ?? item.item_id)}`}
        actions={
          <>
            <Button onClick={() => window.history.back()} variant="secondary">
              Back
            </Button>
            <Button
              onClick={() => {
                refreshPrintedAt();
                window.print();
              }}
              variant="primary"
            >
              Print
            </Button>
          </>
        }
      />
      </div>

      <div className="item-detail-print-root p-6 space-y-6">
        <div className="item-detail-print-sheet">
          <header className="item-detail-print-page-header" aria-hidden="true">
            <h3 className="item-detail-print-page-header-title">{SYSTEM_HEADER_TITLE}</h3>
          </header>

          <Card className="item-detail-print-area">
            <div className="item-detail-print-item-heading">
              <h1>{itemName}</h1>
              <p>
                Item ID: {formatDisplayValue(itemId)} · Inventory:{" "}
                {formatDisplayValue(inventoryName)}
              </p>
            </div>

            <div className="item-detail-print-content">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DetailField label="Item ID" value={formatDisplayValue(item.id ?? item.item_id)} />
            <DetailField label="Inventory" value={formatDisplayValue(inventoryName)} />
            <DetailField label="Item Name" value={formatDisplayValue(itemName)} />
            <DetailField label="Item Code" value={formatDisplayValue(itemCode)} />
            <DetailField label="Serial No" value={formatDisplayValue(serialNo)} />
            <DetailField label="Serial No 2" value={formatDisplayValue(serialNo2)} />
            <DetailField label="Model" value={formatDisplayValue(model)} />
            <DetailField label="Page No" value={formatDisplayValue(pageno)} />
            <DetailField label="Value" value={formatRupee(value)} />
            <DetailField label="Purchase Date" value={formatDate(purchaseDate)} />
            <DetailField label="PO No" value={formatDisplayValue(poNo)} />
            <DetailField label="GIN No" value={formatDisplayValue(ginNo)} />
            <DetailField label="Supplier" value={formatDisplayValue(supplier)} />
            <DetailField label="Funding Source" value={formatDisplayValue(funding)} />
            <DetailField label="Received From" value={formatDisplayValue(receivedfrom)} />
            <DetailField label="Warranty" value={formatDisplayValue(warranty)} />
            <DetailField label="Location" value={formatDisplayValue(locationValue)} />
            <DetailField
              label="Status"
              value={
                <>
                  <span className="item-detail-print-status">{statusLabel}</span>
                  <span className="item-detail-print-hide">
                    <Badge
                      label={statusLabel}
                      variant={statusMeta?.color || "primary"}
                    />
                  </span>
                </>
              }
            />
            <DetailField label="Created At" value={formatDateTime(createdAt)} />
            <DetailField label="Last Updated" value={formatDateTime(updatedAt)} />
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-border-lighter pt-8">
            <DetailField
              label="QR Code"
              value={
                <div className="space-y-3">
                  {qr1ImageUrl ? (
                    <img
                      src={qr1ImageUrl}
                      alt="QR Code"
                      className="h-44 w-44 rounded-lg border border-border bg-white p-2"
                    />
                  ) : (
                    <p className="text-sm text-text-light">-</p>
                  )}
                  <p className="font-mono text-sm break-all">{formatDisplayValue(qrCode)}</p>
                  {qr1ScanUrl ? (
                    <a
                      href={qr1ScanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="item-detail-print-hide text-primary-700 underline text-sm"
                    >
                      Open scan link
                    </a>
                  ) : null}
                </div>
              }
            />
            <DetailField
              label="QR Code 2"
              value={
                <div className="space-y-3">
                  {qr2ImageUrl ? (
                    <img
                      src={qr2ImageUrl}
                      alt="QR Code 2"
                      className="h-44 w-44 rounded-lg border border-border bg-white p-2"
                    />
                  ) : (
                    <p className="text-sm text-text-light">-</p>
                  )}
                  <p className="font-mono text-sm break-all">{formatDisplayValue(qrCode2)}</p>
                  {qr2ScanUrl ? (
                    <a
                      href={qr2ScanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="item-detail-print-hide text-primary-700 underline text-sm"
                    >
                      Open scan link
                    </a>
                  ) : null}
                </div>
              }
            />
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border-lighter pt-8">
            <DetailField
              label="Item Image"
              value={
                imageUrl ? (
                  <div className="space-y-3">
                    <img
                      src={imageUrl}
                      alt={itemName}
                      className="max-h-64 rounded-lg border border-border object-contain bg-white"
                    />
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="item-detail-print-hide text-primary-700 underline text-sm"
                    >
                      Open full image
                    </a>
                  </div>
                ) : (
                  "-"
                )
              }
            />
            <DetailField
              label="GIN PDF"
              value={
                ginPdfUrl ? (
                  <>
                    <span className="item-detail-print-url">{ginPdfUrl}</span>
                    <a
                      href={ginPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="item-detail-print-hide inline-flex items-center gap-2 text-primary-700 underline text-sm font-medium"
                    >
                      <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                      View GIN PDF
                    </a>
                  </>
                ) : (
                  "-"
                )
              }
            />
          </div>

          <div className="item-detail-print-full-width mt-8 border-t border-border-lighter pt-8">
            <DetailField
              label="Remarks"
              value={<p className="whitespace-pre-wrap">{formatDisplayValue(remarks)}</p>}
            />
          </div>
            </div>

          {!(["registrar", "dean"].includes(rolePath)) && (
            <div className="no-print mt-8 flex flex-wrap justify-end gap-3 border-t border-border-lighter pt-6">
              {canReturnItem && (
                <Button
                  variant="secondary"
                  icon="assignment_return"
                  onClick={handleReturnItem}
                  disabled={returning}
                >
                  {returning ? "Returning..." : "Return Item"}
                </Button>
              )}
              <Button variant="primary" icon="edit" onClick={() => navigate(updatePath)}>
                Update
              </Button>
              {returnError && <p className="basis-full text-sm text-red-600">{returnError}</p>}
            </div>
          )}
        </Card>

        <footer className="item-detail-print-page-footer" aria-hidden="true">
          <span>Printed: {printedAt || "—"}</span>
        </footer>
        </div>
      </div>
    </MainLayout>
  );
};

export default ItemDetail;
