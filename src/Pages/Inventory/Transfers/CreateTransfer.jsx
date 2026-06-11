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
import { resolveSidebarVariant } from "../../../utils/helpers";
import TransferSubmissionForm from "./TransferSubmissionForm";

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
  quantity: 1,
});

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

const CreateTransfer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);

  const [assignedInventories, setAssignedInventories] = useState([]);
  const [allInventories, setAllInventories] = useState([]);
  const [sourceInventoryId, setSourceInventoryId] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [browseSelectedIds, setBrowseSelectedIds] = useState([]);
  const [transferListItems, setTransferListItems] = useState([]);
  const [transferSelectedIds, setTransferSelectedIds] = useState([]);
  const [activeView, setActiveView] = useState("browse");
  const [toInventoryId, setToInventoryId] = useState("");
  const [reason, setReason] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(getStoredUser);

  const transferListPath = role
    ? `/inventory/transfers/list/${role}`
    : "/inventory/transfers/list";

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

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
        setAllInventories(inventories);
        setAssignedInventories(
          inventories.filter(
            (inventory) => String(inventory.inchargeId) === String(storedUser.id)
          )
        );
      } catch (error) {
        if (isMounted) {
          setAssignedInventories([]);
          setAllInventories([]);
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
  }, []);

  useEffect(() => {
    if (!sourceInventoryId) {
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
          `${API_BASE_URL}/api/items?inventoryId=${sourceInventoryId}`
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
  }, [sourceInventoryId]);

  const sourceInventoryOptions = useMemo(
    () =>
      assignedInventories.map((inventory) => ({
        value: String(inventory.id),
        label: inventory.location && inventory.name && inventory.location !== inventory.name
          ? `${inventory.name} (${inventory.location})`
          : inventory.name || inventory.location || `Inventory #${inventory.id}`,
      })),
    [assignedInventories]
  );

  const destinationInventoryOptions = useMemo(
    () =>
      allInventories
        .filter((inventory) => String(inventory.id) !== String(sourceInventoryId))
        .map((inventory) => ({
          value: String(inventory.id),
          label: inventory.location && inventory.name && inventory.location !== inventory.name
            ? `${inventory.name} (${inventory.location})`
            : inventory.name || inventory.location || `Inventory #${inventory.id}`,
        })),
    [allInventories, sourceInventoryId]
  );

  const filteredInventoryItems = useMemo(
    () => filterItemsBySearch(inventoryItems, itemSearchTerm),
    [inventoryItems, itemSearchTerm]
  );

  const browseRows = useMemo(
    () =>
      filteredInventoryItems.map((item) => ({
        ...item,
        _item: item,
      })),
    [filteredInventoryItems]
  );

  const transferListRows = useMemo(
    () =>
      transferListItems.map((item) => ({
        ...item,
        _item: item,
      })),
    [transferListItems]
  );

  const sourceInventory = useMemo(
    () => assignedInventories.find((inventory) => String(inventory.id) === String(sourceInventoryId)) || null,
    [assignedInventories, sourceInventoryId]
  );

  const destinationInventory = useMemo(
    () => allInventories.find((inventory) => String(inventory.id) === String(toInventoryId)) || null,
    [allInventories, toInventoryId]
  );

  const itemsForFormPreview = useMemo(
    () => transferListItems.filter((item) => transferSelectedIds.includes(item.id)),
    [transferListItems, transferSelectedIds]
  );

  const canPreviewForm = Boolean(
    sourceInventory
    && destinationInventory
    && transferDate
    && itemsForFormPreview.length > 0
  );

  const handlePrintForm = () => {
    window.print();
  };

  const toggleBrowseSelection = (itemId) => {
    setBrowseSelectedIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleTransferSelection = (itemId) => {
    setTransferSelectedIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAllBrowse = () => {
    const visibleIds = browseRows.map((row) => row.id);
    const allSelected = visibleIds.every((id) => browseSelectedIds.includes(id));
    if (allSelected) {
      setBrowseSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setBrowseSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleSelectAllTransferList = () => {
    const visibleIds = transferListRows.map((row) => row.id);
    const allSelected = visibleIds.every((id) => transferSelectedIds.includes(id));
    if (allSelected) {
      setTransferSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setTransferSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleAddToTransferList = () => {
    const selectedItems = inventoryItems.filter((item) => browseSelectedIds.includes(item.id));
    setTransferListItems((prev) => {
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

  const handleRemoveFromTransferList = () => {
    setTransferListItems((prev) => prev.filter((item) => !transferSelectedIds.includes(item.id)));
    setTransferSelectedIds([]);
  };

  const handleSourceInventoryChange = (value) => {
    setSourceInventoryId(value);
    setTransferListItems([]);
    setTransferSelectedIds([]);
    setBrowseSelectedIds([]);
    setToInventoryId("");
    setActiveView("browse");
  };

  const handleSubmitTransfer = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    const storedUser = getStoredUser();
    const initiatedById = Number(storedUser.id ?? 0);
    const itemsToTransfer = transferListItems.filter((item) => transferSelectedIds.includes(item.id));

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      setSubmitError("Your session is missing a user id. Please sign in again.");
      return;
    }

    if (itemsToTransfer.length === 0) {
      setSubmitError("Select at least one item from the transfer list to submit.");
      return;
    }

    if (!toInventoryId) {
      setSubmitError("Please select a destination inventory.");
      return;
    }

    if (!reason.trim()) {
      setSubmitError("Transfer reason is required.");
      return;
    }

    if (!transferDate) {
      setSubmitError("Transfer date is required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/api/item-transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiatedById,
          fromInventoryId: Number(sourceInventoryId),
          toInventoryId: Number(toInventoryId),
          reason: reason.trim(),
          transferDate,
          items: itemsToTransfer.map((item) => ({
            itemId: item.id,
            quantity: 1,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to submit item transfer.");
      }

      setSubmitMessage(data.message || "Transfer request submitted successfully.");
      setTimeout(() => {
        navigate(transferListPath);
      }, 1200);
    } catch (error) {
      setSubmitError(error.message || "Failed to submit item transfer.");
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
          checked={browseRows.length > 0 && browseRows.every((row) => browseSelectedIds.includes(row.id))}
          onChange={handleSelectAllBrowse}
          aria-label="Select all visible items"
        />
      ),
      sortable: false,
      render: (_value, row) => (
        <input
          type="checkbox"
          checked={browseSelectedIds.includes(row.id)}
          onChange={() => toggleBrowseSelection(row.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${row.itemName}`}
        />
      ),
    },
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "serialNo", label: "Serial No.", sortable: true },
    { field: "status", label: "Status", sortable: true },
  ];

  const transferListColumns = [
    {
      field: "selected",
      label: (
        <input
          type="checkbox"
          checked={
            transferListRows.length > 0
            && transferListRows.every((row) => transferSelectedIds.includes(row.id))
          }
          onChange={handleSelectAllTransferList}
          aria-label="Select all transfer list items"
        />
      ),
      sortable: false,
      render: (_value, row) => (
        <input
          type="checkbox"
          checked={transferSelectedIds.includes(row.id)}
          onChange={() => toggleTransferSelection(row.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Include ${row.itemName} in transfer`}
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
        title="Create Transfer"
        subtitle="Select items from an assigned inventory and submit them as one transfer request."
        actions={
          <Button variant="secondary" onClick={() => navigate(transferListPath)}>
            Back to Transfers
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
              name="sourceInventoryId"
              options={sourceInventoryOptions}
              value={sourceInventoryId}
              onChange={handleSourceInventoryChange}
              placeholder={optionsLoading ? "Loading inventories..." : "Select source inventory"}
              required
              disabled={optionsLoading || sourceInventoryOptions.length === 0}
            />
          </div>
          {!optionsLoading && sourceInventoryOptions.length === 0 ? (
            <p className="mt-4 text-sm text-text-light">
              No assigned inventories were found for your account.
            </p>
          ) : null}
        </Card>

        {sourceInventoryId ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={activeView === "browse" ? "primary" : "secondary"}
                onClick={() => setActiveView("browse")}
              >
                Browse Items
              </Button>
              <Button
                variant={activeView === "transfer-list" ? "primary" : "secondary"}
                onClick={() => setActiveView("transfer-list")}
                icon="playlist_add_check"
              >
                View Transfer List ({transferListItems.length})
              </Button>
            </div>

            {activeView === "browse" ? (
              <Card title="Inventory Items" icon="search" subtitle="Search and select items to add to the transfer list.">
                <div className="space-y-4">
                  <SearchBox
                    placeholder="Search by item name, item code, or serial no."
                    value={itemSearchTerm}
                    onChange={setItemSearchTerm}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-light">
                      {browseSelectedIds.length} item{browseSelectedIds.length === 1 ? "" : "s"} selected
                    </p>
                    <Button
                      variant="primary"
                      icon="playlist_add"
                      onClick={handleAddToTransferList}
                      disabled={browseSelectedIds.length === 0}
                    >
                      Add to Transfer List
                    </Button>
                  </div>

                  <Table
                    columns={browseColumns}
                    data={browseRows}
                    onRowClick={(row) => toggleBrowseSelection(row.id)}
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
                title="Transfer List"
                icon="compare_arrows"
                subtitle="Review staged items and choose which ones to include in this transfer submission."
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-light">
                      {transferSelectedIds.length} of {transferListItems.length} staged item
                      {transferListItems.length === 1 ? "" : "s"} selected for transfer
                    </p>
                    <Button
                      variant="secondary"
                      onClick={handleRemoveFromTransferList}
                      disabled={transferSelectedIds.length === 0}
                    >
                      Remove Selected
                    </Button>
                  </div>

                  <Table
                    columns={transferListColumns}
                    data={transferListRows}
                    onRowClick={(row) => toggleTransferSelection(row.id)}
                    searchable
                    paginated={transferListRows.length > 10}
                    itemsPerPage={10}
                  />

                  {transferListRows.length === 0 ? (
                    <p className="text-sm text-text-light">
                      No items in the transfer list yet. Browse items and use Add to Transfer List.
                    </p>
                  ) : null}

                  {transferListItems.length > 0 ? (
                    <div className="border-t border-border-lighter pt-6 space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-text-dark">Transfer Submission</h3>
                        <p className="mt-1 text-sm text-text-light">
                          Select the destination inventory and transfer date. Part A of the official form will be generated from your selections.
                        </p>
                      </div>

                      <form onSubmit={handleSubmitTransfer} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Select
                            label="Transfer To (Receiving Inventory)"
                            name="toInventoryId"
                            options={destinationInventoryOptions}
                            value={toInventoryId}
                            onChange={setToInventoryId}
                            placeholder="Select destination inventory"
                            required
                          />
                          <FormInput
                            label="Transfer Date"
                            name="transferDate"
                            type="date"
                            value={transferDate}
                            onChange={(event) => setTransferDate(event.target.value)}
                            required
                          />
                        </div>

                        <FormInput
                          label="Reason (for approval record)"
                          name="reason"
                          type="textarea"
                          placeholder="Explain why these items are being transferred..."
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          required
                        />

                        {canPreviewForm ? (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold text-text-dark">
                                Part A – Official Transfer Form Preview
                              </h4>
                              <Button type="button" variant="secondary" icon="print" onClick={handlePrintForm}>
                                Print Form
                              </Button>
                            </div>

                            <TransferSubmissionForm
                              sourceInventory={sourceInventory}
                              destinationInventory={destinationInventory}
                              transferDate={transferDate}
                              items={itemsForFormPreview}
                              issuedByName={currentUser.name || currentUser.fullName || "—"}
                              issuedByPost={currentUser.designation || "Inventory Officer"}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-text-light">
                            Select destination inventory, transfer date, and at least one item to preview Part A of the transfer form.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="submit"
                            variant="primary"
                            loading={isSubmitting}
                            disabled={isSubmitting || !canPreviewForm || !reason.trim()}
                          >
                            Submit Transfer for Approval
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => navigate(transferListPath)}
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

export default CreateTransfer;
