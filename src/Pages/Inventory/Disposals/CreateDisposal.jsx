import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { DISPOSAL_REASONS, DISPOSAL_TYPES, CONDITION_ASSESSMENT } from "../../../utils/constants";
import { resolveSidebarVariant } from "../../../utils/helpers";
import DisposalSubmissionForm from "./DisposalSubmissionForm";

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
  purchaseDate: item.purchaseDate || item.purchase_date || "",
  funding: item.funding || item.funding_source || "",
  fundingOther: item.fundingOther || item.funding_other || "",
  transferLocked: Boolean(item.transferLocked),
  transferLockReason: item.transferLockReason || "",
  disposalLocked: Boolean(item.disposalLocked),
  disposalLockReason: item.disposalLockReason || "",
});

const isItemLocked = (item = {}) => Boolean(item.transferLocked || item.disposalLocked);

const formatItemAvailabilityStatus = (item = {}) => {
  if (item.transferLocked) {
    if (item.transferLockReason === "completed") {
      return "Transfer completed";
    }
    return "Pending transfer approval";
  }

  if (item.disposalLocked) {
    if (item.disposalLockReason === "completed") {
      return "Disposal completed";
    }
    return "Pending disposal approval";
  }

  return item.status || "—";
};

const getSelectableBrowseRows = (rows = []) => rows.filter((row) => !isItemLocked(row));

const filterItemsBySearch = (items, searchText = "") => {
  const query = String(searchText || "").trim().toLowerCase();
  if (!query) {
    return items;
  }

  return items.filter((item) => {
    const haystack = [
      item.itemName,
      item.itemCode,
      item.serialNo,
      item.model,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(query);
  });
};

const CreateDisposal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const [searchParams] = useSearchParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const linkedItemId = Number(searchParams.get("itemId") ?? 0);

  const [assignedInventories, setAssignedInventories] = useState([]);
  const [inventoryId, setInventoryId] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [browseSelectedIds, setBrowseSelectedIds] = useState([]);
  const [disposalListItems, setDisposalListItems] = useState([]);
  const [disposalSelectedIds, setDisposalSelectedIds] = useState([]);
  const [activeView, setActiveView] = useState("browse");
  const [reason, setReason] = useState("");
  const [reasonOtherDetails, setReasonOtherDetails] = useState("");
  const [disposalType, setDisposalType] = useState("");
  const [disposalTypeDetails, setDisposalTypeDetails] = useState("");
  const [condition, setCondition] = useState("");
  const [description, setDescription] = useState("");
  const [disposalDate, setDisposalDate] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [linkedItemHandled, setLinkedItemHandled] = useState(false);

  const disposalListPath = role
    ? `/inventory/disposals/list/${role}`
    : "/inventory/disposals/list";

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

        if (!isMounted) {
          return;
        }

        const inventories = data.inventories || data.data || [];
        const assigned = inventories.filter(
          (entry) => String(entry.inchargeId) === String(storedUser.id)
        );
        setAssignedInventories(assigned);

        if (linkedItemId > 0) {
          const linkedItemResponse = await fetch(`${API_BASE_URL}/api/items/${linkedItemId}`);
          const linkedItemData = await linkedItemResponse.json().catch(() => ({}));
          const linkedInventoryId = Number(
            linkedItemData?.item?.inventory_id ?? linkedItemData?.item?.inventoryId ?? 0
          );

          if (linkedInventoryId > 0) {
            setInventoryId(String(linkedInventoryId));
          }
        }
      } catch (error) {
        if (isMounted) {
          setAssignedInventories([]);
          setLoadError(error.message || "Failed to load inventories.");
        }
      } finally {
        if (isMounted) {
          setOptionsLoading(false);
        }
      }
    };

    loadInventories();

    return () => {
      isMounted = false;
    };
  }, [linkedItemId]);

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

        const response = await fetch(
          `${API_BASE_URL}/api/items?inventoryId=${inventoryId}`
        );
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
        if (isMounted) {
          setItemsLoading(false);
        }
      }
    };

    loadItems();

    return () => {
      isMounted = false;
    };
  }, [inventoryId]);

  useEffect(() => {
    if (linkedItemHandled || linkedItemId <= 0 || inventoryItems.length === 0) {
      return;
    }

    const linkedItem = inventoryItems.find((item) => Number(item.id) === linkedItemId);
    if (linkedItem && !isItemLocked(linkedItem)) {
      setDisposalListItems((prev) => {
        if (prev.some((item) => item.id === linkedItem.id)) {
          return prev;
        }
        return [...prev, linkedItem];
      });
      setDisposalSelectedIds((prev) =>
        prev.includes(linkedItem.id) ? prev : [...prev, linkedItem.id]
      );
      setActiveView("disposal-list");
    }

    setLinkedItemHandled(true);
  }, [inventoryItems, linkedItemHandled, linkedItemId]);

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
    () =>
      filteredInventoryItems.map((item) => ({
        ...item,
        availabilityStatus: formatItemAvailabilityStatus(item),
        _item: item,
      })),
    [filteredInventoryItems]
  );

  const selectableBrowseRows = useMemo(
    () => getSelectableBrowseRows(browseRows),
    [browseRows]
  );

  const disposalListRows = useMemo(
    () =>
      disposalListItems.map((item) => ({
        ...item,
        _item: item,
      })),
    [disposalListItems]
  );

  const itemsToSubmit = useMemo(
    () => disposalListItems.filter((item) => disposalSelectedIds.includes(item.id)),
    [disposalListItems, disposalSelectedIds]
  );

  const selectedInventory = useMemo(
    () => assignedInventories.find((entry) => String(entry.id) === String(inventoryId)) || null,
    [assignedInventories, inventoryId]
  );

  const canPreviewForm = Boolean(
    selectedInventory
    && disposalDate
    && itemsToSubmit.length > 0
  );

  const canSubmit = Boolean(
    inventoryId
    && reason.trim()
    && (reason !== "other" || reasonOtherDetails.trim())
    && disposalType
    && (disposalType !== "other" || disposalTypeDetails.trim())
    && condition
    && disposalDate
    && itemsToSubmit.length > 0
  );

  const handlePrintForm = () => {
    window.print();
  };

  const toggleBrowseSelection = (itemId) => {
    const item = inventoryItems.find((entry) => entry.id === itemId);
    if (isItemLocked(item)) {
      return;
    }

    setBrowseSelectedIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleDisposalSelection = (itemId) => {
    setDisposalSelectedIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAllBrowse = () => {
    const visibleIds = selectableBrowseRows.map((row) => row.id);
    if (visibleIds.length === 0) {
      return;
    }

    const allSelected = visibleIds.every((id) => browseSelectedIds.includes(id));
    if (allSelected) {
      setBrowseSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setBrowseSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleSelectAllDisposalList = () => {
    const visibleIds = disposalListRows.map((row) => row.id);
    const allSelected = visibleIds.every((id) => disposalSelectedIds.includes(id));
    if (allSelected) {
      setDisposalSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setDisposalSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleAddToDisposalList = () => {
    const selectedItems = inventoryItems.filter(
      (item) => browseSelectedIds.includes(item.id) && !isItemLocked(item)
    );
    setDisposalListItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.id));
      const nextItems = [...prev];
      selectedItems.forEach((item) => {
        if (!existingIds.has(item.id)) {
          nextItems.push(item);
        }
      });
      return nextItems;
    });
    setBrowseSelectedIds([]);
  };

  const handleRemoveFromDisposalList = () => {
    setDisposalListItems((prev) => prev.filter((item) => !disposalSelectedIds.includes(item.id)));
    setDisposalSelectedIds([]);
  };

  const handleInventoryChange = (value) => {
    setInventoryId(value);
    setDisposalListItems([]);
    setDisposalSelectedIds([]);
    setBrowseSelectedIds([]);
    setActiveView("browse");
    setLinkedItemHandled(false);
  };

  const handleSubmitDisposal = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    const storedUser = getStoredUser();
    const initiatedById = Number(storedUser.id ?? 0);
    const selectedItems = disposalListItems.filter(
      (item) => disposalSelectedIds.includes(item.id) && !isItemLocked(item)
    );

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      setSubmitError("Your session is missing a user id. Please sign in again.");
      return;
    }

    if (selectedItems.length === 0) {
      setSubmitError("Select at least one item from the disposal list to submit.");
      return;
    }

    if (!reason.trim()) {
      setSubmitError("Disposal reason is required.");
      return;
    }

    if (reason === "other" && !reasonOtherDetails.trim()) {
      setSubmitError("Please describe the disposal reason.");
      return;
    }

    if (!disposalType) {
      setSubmitError("Disposal type is required.");
      return;
    }

    if (disposalType === "other" && !disposalTypeDetails.trim()) {
      setSubmitError("Please describe the disposal type.");
      return;
    }

    if (!condition) {
      setSubmitError("Condition assessment is required.");
      return;
    }

    if (!disposalDate) {
      setSubmitError("Disposal date is required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/api/item-disposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiatedById,
          inventoryId: Number(inventoryId),
          reason: reason.trim(),
          reasonOtherDetails: reason === "other" ? reasonOtherDetails.trim() : "",
          disposalType,
          disposalTypeDetails: disposalType === "other" ? disposalTypeDetails.trim() : "",
          condition,
          description: description.trim(),
          disposalDate,
          items: selectedItems.map((item) => ({
            itemId: item.id,
            quantity: 1,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to submit disposal request.");
      }

      setSubmitMessage(data.message || "Disposal request submitted successfully.");
      setTimeout(() => {
        navigate(disposalListPath);
      }, 1200);
    } catch (error) {
      setSubmitError(error.message || "Failed to submit disposal request.");
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
          checked={
            selectableBrowseRows.length > 0
            && selectableBrowseRows.every((row) => browseSelectedIds.includes(row.id))
          }
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
          disabled={isItemLocked(row)}
          onChange={() => toggleBrowseSelection(row.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${row.itemName}`}
        />
      ),
    },
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "serialNo", label: "Serial No.", sortable: true },
    { field: "availabilityStatus", label: "Status", sortable: true },
  ];

  const disposalListColumns = [
    {
      field: "selected",
      label: (
        <input
          type="checkbox"
          checked={
            disposalListRows.length > 0
            && disposalListRows.every((row) => disposalSelectedIds.includes(row.id))
          }
          onChange={handleSelectAllDisposalList}
          aria-label="Select all disposal list items"
        />
      ),
      sortable: false,
      render: (_value, row) => (
        <input
          type="checkbox"
          checked={disposalSelectedIds.includes(row.id)}
          onChange={() => toggleDisposalSelection(row.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Include ${row.itemName} in disposal`}
        />
      ),
    },
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "serialNo", label: "Serial No.", sortable: true },
    { field: "status", label: "Status", sortable: true },
  ];

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Create Disposal Request"
        subtitle="Select items from an assigned inventory and submit them as one disposal request."
        actions={
          <Button variant="secondary" onClick={() => navigate(disposalListPath)}>
            Back to Disposals
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}
        {submitError ? <p className="text-sm text-error">{submitError}</p> : null}
        {submitMessage ? <p className="text-sm text-success">{submitMessage}</p> : null}

        <Card title="Source Inventory" icon="inventory_2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
          {!optionsLoading && inventoryOptions.length === 0 ? (
            <p className="mt-4 text-sm text-text-light">
              No assigned inventories were found for your account.
            </p>
          ) : null}
        </Card>

        {inventoryId ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={activeView === "browse" ? "primary" : "secondary"}
                onClick={() => setActiveView("browse")}
              >
                Browse Items
              </Button>
              <Button
                variant={activeView === "disposal-list" ? "primary" : "secondary"}
                onClick={() => setActiveView("disposal-list")}
                icon="playlist_add_check"
              >
                View Disposal List ({disposalListItems.length})
              </Button>
            </div>

            {activeView === "browse" ? (
              <Card
                title="Inventory Items"
                icon="search"
                subtitle="Search and select items to add to the disposal list. Items in a pending or completed transfer or disposal appear dimmed and cannot be selected."
              >
                <div className="space-y-4">
                  <SearchBox
                    placeholder="Search by item name, item code, or serial no."
                    value={itemSearchTerm}
                    onChange={setItemSearchTerm}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-light">
                      {browseSelectedIds.length} item{browseSelectedIds.length === 1 ? "" : "s"} selected
                      {selectableBrowseRows.length !== browseRows.length ? (
                        <span>
                          {" "}
                          · {browseRows.length - selectableBrowseRows.length} unavailable
                        </span>
                      ) : null}
                    </p>
                    <Button
                      variant="primary"
                      icon="playlist_add"
                      onClick={handleAddToDisposalList}
                      disabled={browseSelectedIds.length === 0}
                    >
                      Add to Disposal List
                    </Button>
                  </div>

                  <Table
                    columns={browseColumns}
                    data={browseRows}
                    onRowClick={(row) => toggleBrowseSelection(row.id)}
                    isRowDisabled={(row) => isItemLocked(row)}
                    loading={itemsLoading}
                    searchable={false}
                    paginated={browseRows.length > 10}
                    itemsPerPage={10}
                  />

                  {!itemsLoading && browseRows.length === 0 ? (
                    <p className="text-sm text-text-light">No items matched your search in this inventory.</p>
                  ) : null}
                </div>
              </Card>
            ) : (
              <Card
                title="Disposal List"
                icon="delete_sweep"
                subtitle="Review staged items and choose which ones to include in this disposal submission."
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-light">
                      {disposalSelectedIds.length} of {disposalListItems.length} staged item
                      {disposalListItems.length === 1 ? "" : "s"} selected for disposal
                    </p>
                    <Button
                      variant="secondary"
                      onClick={handleRemoveFromDisposalList}
                      disabled={disposalSelectedIds.length === 0}
                    >
                      Remove Selected
                    </Button>
                  </div>

                  <Table
                    columns={disposalListColumns}
                    data={disposalListRows}
                    onRowClick={(row) => toggleDisposalSelection(row.id)}
                    searchable
                    paginated={disposalListRows.length > 10}
                    itemsPerPage={10}
                  />

                  {disposalListRows.length === 0 ? (
                    <p className="text-sm text-text-light">
                      No items in the disposal list yet. Browse items and use Add to Disposal List.
                    </p>
                  ) : null}

                  {disposalListItems.length > 0 ? (
                    <div className="border-t border-border-lighter pt-6 space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-text-dark">Disposal Submission</h3>
                        <p className="mt-1 text-sm text-text-light">
                          Provide disposal details for the selected items. The official form is generated from your selections below.
                        </p>
                      </div>

                      <form onSubmit={handleSubmitDisposal} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Select
                            label="Reason for Disposal"
                            name="reason"
                            options={DISPOSAL_REASONS}
                            value={reason}
                            onChange={(value) => {
                              setReason(value);
                              if (value !== "other") {
                                setReasonOtherDetails("");
                              }
                            }}
                            placeholder="Select reason"
                            required
                          />
                          <Select
                            label="Disposal Type"
                            name="disposalType"
                            options={DISPOSAL_TYPES}
                            value={disposalType}
                            onChange={(value) => {
                              setDisposalType(value);
                              if (value !== "other") {
                                setDisposalTypeDetails("");
                              }
                            }}
                            placeholder="Select disposal type"
                            required
                          />
                        </div>

                        {reason === "other" ? (
                          <FormInput
                            label="Reason Details"
                            name="reasonOtherDetails"
                            type="textarea"
                            placeholder="Describe the reason for disposal..."
                            value={reasonOtherDetails}
                            onChange={(event) => setReasonOtherDetails(event.target.value)}
                            required
                          />
                        ) : null}

                        {disposalType === "other" ? (
                          <FormInput
                            label="Disposal Type Details"
                            name="disposalTypeDetails"
                            type="textarea"
                            placeholder="Describe the disposal type..."
                            value={disposalTypeDetails}
                            onChange={(event) => setDisposalTypeDetails(event.target.value)}
                            required
                          />
                        ) : null}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Select
                            label="Condition Assessment"
                            name="condition"
                            options={CONDITION_ASSESSMENT}
                            value={condition}
                            onChange={setCondition}
                            placeholder="Select condition"
                            required
                          />
                          <FormInput
                            label="Disposal Date"
                            name="disposalDate"
                            type="date"
                            value={disposalDate}
                            onChange={(event) => setDisposalDate(event.target.value)}
                            required
                          />
                        </div>

                        <FormInput
                          label="Description"
                          name="description"
                          type="textarea"
                          placeholder="Additional details about the disposal..."
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                        />

                        {canPreviewForm ? (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold text-text-dark">
                                Official Disposal Form Preview
                              </h4>
                              <Button type="button" variant="secondary" icon="print" onClick={handlePrintForm}>
                                Print Form
                              </Button>
                            </div>

                            <DisposalSubmissionForm
                              inventory={selectedInventory}
                              items={itemsToSubmit}
                              disposalDate={disposalDate}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-text-light">
                            Select disposal date and at least one item to preview the official disposal form.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="submit"
                            variant="primary"
                            loading={isSubmitting}
                            disabled={isSubmitting || !canSubmit}
                          >
                            Submit Disposal for Approval
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => navigate(disposalListPath)}
                            disabled={isSubmitting}
                          >
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

export default CreateDisposal;
