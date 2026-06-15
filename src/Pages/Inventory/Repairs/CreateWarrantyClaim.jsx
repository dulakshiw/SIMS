import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../../Components/Layouts/MainLayout";
import {
  Card,
  Button,
  SearchBox,
  Table,
  Select,
  FormInput,
  PageHeader,
} from "../../../Components/UI";
import { isItemInWarranty, resolveSidebarVariant } from "../../../utils/helpers";
import WarrantyClaimLetterForm from "./WarrantyClaimLetterForm";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

const normalizeInventoryItem = (item = {}) => ({
  ...item,
  id: item.id ?? item.item_id,
  itemName: item.itemName || item.item_name || item.name || "—",
  itemCode: item.itemCode || item.item_code || "—",
  serialNo: item.serialNo || item.serial_no || "—",
  model: item.model || "—",
  brand: item.brand || item.manufacturer || "—",
  location: item.location || "—",
  status: item.status || "—",
  value: item.value ?? "",
  ginNo: item.ginNo || item.gin_no || "",
  pageno: item.pageno || item.page_no || item.pageNo || "",
  purchaseDate: item.purchaseDate || item.purchase_date || item.purchased_date || item.created_at || item.createdAt || "",
  warranty: item.warranty || "",
  supplier: item.supplier || "",
  poNo: item.poNo || item.po_no || "",
  transferLocked: Boolean(item.transferLocked),
  transferLockReason: item.transferLockReason || "",
  disposalLocked: Boolean(item.disposalLocked),
  disposalLockReason: item.disposalLockReason || "",
  repairLocked: Boolean(item.repairLocked),
  repairLockReason: item.repairLockReason || "",
  warrantyClaimLocked: Boolean(item.warrantyClaimLocked),
  warrantyClaimLockReason: item.warrantyClaimLockReason || "",
});

const isItemLocked = (item = {}) =>
  Boolean(item.transferLocked || item.disposalLocked || item.repairLocked || item.warrantyClaimLocked);

const formatItemAvailabilityStatus = (item = {}) => {
  if (item.transferLocked) {
    return item.transferLockReason === "completed" ? "Transfer completed" : "Pending transfer approval";
  }
  if (item.disposalLocked) {
    return item.disposalLockReason === "completed" ? "Disposal completed" : "Pending disposal approval";
  }
  if (item.repairLocked) {
    return item.repairLockReason === "completed" ? "Repair completed" : "Pending repair";
  }
  if (item.warrantyClaimLocked) {
    return item.warrantyClaimLockReason === "completed" ? "Warranty claim completed" : "Pending warranty claim";
  }
  if (!isItemInWarranty(item, item.warranty)) {
    return "Out of warranty period";
  }
  return item.status || "—";
};

const isWithinWarrantyPeriod = (item = {}) =>
  isItemInWarranty(item, item.warranty);

const isWarrantyClaimEligible = (item = {}) =>
  !isItemLocked(item) && isWithinWarrantyPeriod(item);

const renderAvailabilityStatus = (value) => {
  const isWarrantyBlocked = value === "Within warranty period" || value === "Out of warranty period";
  return (
    <span className={isWarrantyBlocked ? "font-medium text-warning" : undefined}>
      {value}
    </span>
  );
};

const filterItemsBySearch = (items, searchText = "") => {
  const query = String(searchText || "").trim().toLowerCase();
  if (!query) return items;

  return items.filter((item) => {
    const haystack = [item.itemName, item.itemCode, item.serialNo, item.model]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(query);
  });
};

const CreateWarrantyClaim = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);

  const [assignedInventories, setAssignedInventories] = useState([]);
  const [inventoryId, setInventoryId] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [browseSelectedIds, setBrowseSelectedIds] = useState([]);
  const [claimListItems, setClaimListItems] = useState([]);
  const [claimSelectedIds, setClaimSelectedIds] = useState([]);
  const [activeView, setActiveView] = useState("browse");
  const [faultDescription, setFaultDescription] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  const claimListPath = role
    ? `/inventory/repairs/warranty-claims/list/${role}`
    : "/inventory/repairs/warranty-claims/list";

  useEffect(() => {
    let isMounted = true;
    const loadInventories = async () => {
      try {
        setOptionsLoading(true);
        setLoadError("");
        const storedUser = getStoredUser();
        const response = await fetch(`${API_BASE_URL}/api/inventories`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load inventories.");
        }
        if (!isMounted) return;
        const inventories = data.inventories || data.data || [];
        setAssignedInventories(
          inventories.filter((entry) => String(entry.inchargeId) === String(storedUser.id))
        );
      } catch (error) {
        if (isMounted) {
          setAssignedInventories([]);
          setLoadError(error.message || "Failed to load inventories.");
        }
      } finally {
        if (isMounted) setOptionsLoading(false);
      }
    };
    loadInventories();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!inventoryId) {
      setInventoryItems([]);
      setBrowseSelectedIds([]);
      return undefined;
    }

    let isMounted = true;
    const loadItems = async () => {
      try {
        setItemsLoading(true);
        setLoadError("");
        const response = await fetch(`${API_BASE_URL}/api/items?inventoryId=${inventoryId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load inventory items.");
        }
        if (isMounted) {
          setInventoryItems((data.items || []).map(normalizeInventoryItem));
          setBrowseSelectedIds([]);
        }
      } catch (error) {
        if (isMounted) {
          setInventoryItems([]);
          setLoadError(error.message || "Failed to load inventory items.");
        }
      } finally {
        if (isMounted) setItemsLoading(false);
      }
    };
    loadItems();
    return () => { isMounted = false; };
  }, [inventoryId]);

  const inventoryOptions = useMemo(
    () =>
      assignedInventories.map((entry) => ({
        value: String(entry.id),
        label: entry.location && entry.name && entry.location !== entry.name
          ? `${entry.name} (${entry.location})`
          : entry.name || entry.location || `Inventory #${entry.id}`,
      })),
    [assignedInventories]
  );

  const filteredInventoryItems = useMemo(
    () => filterItemsBySearch(inventoryItems, itemSearchTerm),
    [inventoryItems, itemSearchTerm]
  );

  const browseRows = useMemo(
    () => filteredInventoryItems.map((item) => ({
      ...item,
      availabilityStatus: formatItemAvailabilityStatus(item),
      _item: item,
    })),
    [filteredInventoryItems]
  );

  const selectableBrowseRows = useMemo(
    () => browseRows.filter((row) => isWarrantyClaimEligible(row)),
    [browseRows]
  );

  const claimListRows = useMemo(
    () => claimListItems.map((item) => ({ ...item, _item: item })),
    [claimListItems]
  );

  const selectedInventory = useMemo(
    () => assignedInventories.find((entry) => String(entry.id) === String(inventoryId)) || null,
    [assignedInventories, inventoryId]
  );

  const itemsToSubmit = useMemo(
    () => claimListItems.filter((item) => claimSelectedIds.includes(item.id)),
    [claimListItems, claimSelectedIds]
  );

  const canPreviewForm = Boolean(selectedInventory && itemsToSubmit.length > 0);
  const canSubmit = Boolean(inventoryId && faultDescription.trim() && itemsToSubmit.length > 0);

  const handlePrintForm = () => window.print();

  const toggleBrowseSelection = (itemId) => {
    const item = inventoryItems.find((entry) => entry.id === itemId);
    if (!isWarrantyClaimEligible(item)) return;
    setBrowseSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleClaimSelection = (itemId) => {
    setClaimSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAllBrowse = () => {
    const visibleIds = selectableBrowseRows.map((row) => row.id);
    if (visibleIds.length === 0) return;
    const allSelected = visibleIds.every((id) => browseSelectedIds.includes(id));
    if (allSelected) {
      setBrowseSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setBrowseSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleSelectAllClaimList = () => {
    const visibleIds = claimListRows.map((row) => row.id);
    const allSelected = visibleIds.every((id) => claimSelectedIds.includes(id));
    if (allSelected) {
      setClaimSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setClaimSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleAddToClaimList = () => {
    const selectedItems = inventoryItems.filter(
      (item) => browseSelectedIds.includes(item.id) && isWarrantyClaimEligible(item)
    );
    setClaimListItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.id));
      const nextItems = [...prev];
      selectedItems.forEach((item) => {
        if (!existingIds.has(item.id)) nextItems.push(item);
      });
      return nextItems;
    });
    setBrowseSelectedIds([]);
  };

  const handleRemoveFromClaimList = () => {
    setClaimListItems((prev) => prev.filter((item) => !claimSelectedIds.includes(item.id)));
    setClaimSelectedIds([]);
  };

  const handleInventoryChange = (value) => {
    setInventoryId(value);
    setClaimListItems([]);
    setClaimSelectedIds([]);
    setBrowseSelectedIds([]);
    setActiveView("browse");
  };

  const handleSubmitClaim = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    const storedUser = getStoredUser();
    const initiatedById = Number(storedUser.id ?? 0);
    const selectedItems = claimListItems.filter(
      (item) => claimSelectedIds.includes(item.id) && isWarrantyClaimEligible(item)
    );

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      setSubmitError("Your session is missing a user id. Please sign in again.");
      return;
    }
    if (selectedItems.length === 0) {
      setSubmitError("Select at least one item from the claim list to submit.");
      return;
    }
    if (!faultDescription.trim()) {
      setSubmitError("Fault description is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/api/warranty-claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiatedById,
          inventoryId: Number(inventoryId),
          faultDescription: faultDescription.trim(),
          claimNotes: claimNotes.trim(),
          items: selectedItems.map((item) => ({ itemId: item.id, quantity: 1 })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to submit warranty claim.");
      }
      setSubmitMessage(data.message || "Warranty claim submitted successfully.");
      setTimeout(() => navigate(claimListPath), 1200);
    } catch (error) {
      setSubmitError(error.message || "Failed to submit warranty claim.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const browseColumns = [
    {
      field: "selected",
      label: (
        <input
          type="checkbox"
          checked={selectableBrowseRows.length > 0 && selectableBrowseRows.every((row) => browseSelectedIds.includes(row.id))}
          onChange={handleSelectAllBrowse}
          disabled={selectableBrowseRows.length === 0}
          aria-label="Select all available items"
        />
      ),
      sortable: false,
      render: (_value, row) => (
        <input
          type="checkbox"
          checked={browseSelectedIds.includes(row.id)}
          disabled={!isWarrantyClaimEligible(row)}
          onChange={() => toggleBrowseSelection(row.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${row.itemName}`}
        />
      ),
    },
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "serialNo", label: "Serial No.", sortable: true },
    { field: "warranty", label: "Warranty", sortable: true },
    {
      field: "availabilityStatus",
      label: "Status",
      sortable: true,
      render: (value) => renderAvailabilityStatus(value),
    },
  ];

  const claimListColumns = [
    {
      field: "selected",
      label: (
        <input
          type="checkbox"
          checked={claimListRows.length > 0 && claimListRows.every((row) => claimSelectedIds.includes(row.id))}
          onChange={handleSelectAllClaimList}
          aria-label="Select all claim list items"
        />
      ),
      sortable: false,
      render: (_value, row) => (
        <input
          type="checkbox"
          checked={claimSelectedIds.includes(row.id)}
          onChange={() => toggleClaimSelection(row.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Include ${row.itemName} in warranty claim`}
        />
      ),
    },
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "serialNo", label: "Serial No.", sortable: true },
    { field: "warranty", label: "Warranty", sortable: true },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Create Warranty Claim"
        subtitle="Select items still under warranty and generate a letter to the Supplies Division."
        actions={<Button variant="secondary" onClick={() => navigate(claimListPath)}>Back to Warranty Claims</Button>}
      />

      <div className="p-6 space-y-6">
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}
        {submitError ? <p className="text-sm text-error">{submitError}</p> : null}
        {submitMessage ? <p className="text-sm text-success">{submitMessage}</p> : null}

        <Card title="Source Inventory" icon="inventory_2">
          <Select
            label="Select Inventory"
            name="inventoryId"
            options={inventoryOptions}
            value={inventoryId}
            onChange={handleInventoryChange}
            placeholder={optionsLoading ? "Loading inventories..." : "Select inventory"}
            required
            disabled={optionsLoading || inventoryOptions.length === 0}
          />
        </Card>

        {inventoryId ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button variant={activeView === "browse" ? "primary" : "secondary"} onClick={() => setActiveView("browse")}>
                Browse Items
              </Button>
              <Button
                variant={activeView === "claim-list" ? "primary" : "secondary"}
                onClick={() => setActiveView("claim-list")}
                icon="playlist_add_check"
              >
                View Claim List ({claimListItems.length})
              </Button>
            </div>

            {activeView === "browse" ? (
              <Card
                title="Inventory Items"
                icon="search"
                subtitle="Only items within the warranty period can be selected. Out-of-warranty items are marked and must be handled via Repairs."
              >
                <div className="space-y-4">
                  <SearchBox placeholder="Search by item name, item code, or serial no." value={itemSearchTerm} onChange={setItemSearchTerm} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-light">
                      {browseSelectedIds.length} selected
                      {selectableBrowseRows.length !== browseRows.length ? (
                        <span> · {browseRows.length - selectableBrowseRows.length} unavailable</span>
                      ) : null}
                    </p>
                    <Button variant="primary" icon="playlist_add" onClick={handleAddToClaimList} disabled={browseSelectedIds.length === 0}>
                      Add to Claim List
                    </Button>
                  </div>
                  <Table
                    columns={browseColumns}
                    data={browseRows}
                    onRowClick={(row) => toggleBrowseSelection(row.id)}
                    isRowDisabled={(row) => !isWarrantyClaimEligible(row)}
                    loading={itemsLoading}
                    searchable={false}
                    paginated={browseRows.length > 10}
                    itemsPerPage={10}
                  />
                </div>
              </Card>
            ) : (
              <Card title="Warranty Claim List" icon="verified_user" subtitle="Review staged items and complete the letter to Supplies Division.">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-light">
                      {claimSelectedIds.length} of {claimListItems.length} staged item
                      {claimListItems.length === 1 ? "" : "s"} selected
                    </p>
                    <Button variant="secondary" onClick={handleRemoveFromClaimList} disabled={claimSelectedIds.length === 0}>
                      Remove Selected
                    </Button>
                  </div>
                  <Table
                    columns={claimListColumns}
                    data={claimListRows}
                    onRowClick={(row) => toggleClaimSelection(row.id)}
                    searchable
                    paginated={claimListRows.length > 10}
                    itemsPerPage={10}
                  />

                  {claimListItems.length > 0 ? (
                    <div className="border-t border-border-lighter pt-6 space-y-6">
                      <form onSubmit={handleSubmitClaim} className="space-y-6">
                        <FormInput
                          label="Fault / Defect Description"
                          name="faultDescription"
                          type="textarea"
                          placeholder="Describe the fault or defect for the warranty claim..."
                          value={faultDescription}
                          onChange={(event) => setFaultDescription(event.target.value)}
                          required
                        />
                        <FormInput
                          label="Additional Notes"
                          name="claimNotes"
                          type="textarea"
                          placeholder="Any additional notes for internal records..."
                          value={claimNotes}
                          onChange={(event) => setClaimNotes(event.target.value)}
                        />

                        {canPreviewForm ? (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold text-text-dark">Inform Supplies Division — Letter Preview</h4>
                              <Button type="button" variant="secondary" icon="print" onClick={handlePrintForm}>Print Letter</Button>
                            </div>
                            <WarrantyClaimLetterForm
                              inventory={selectedInventory}
                              items={itemsToSubmit}
                              faultDescription={faultDescription}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-text-light">Select at least one item to preview the letter.</p>
                        )}

                        <div className="flex flex-wrap gap-3">
                          <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting || !canSubmit}>
                            Submit Warranty Claim
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => navigate(claimListPath)} disabled={isSubmitting}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default CreateWarrantyClaim;
