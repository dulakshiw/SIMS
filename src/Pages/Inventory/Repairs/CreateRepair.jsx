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
import RepairSubmissionForm from "./RepairSubmissionForm";

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
  if (isItemInWarranty(item, item.warranty)) {
    return "Within warranty period";
  }
  return item.status || "—";
};

const isWithinWarrantyPeriod = (item = {}) =>
  isItemInWarranty(item, item.warranty);

const isRepairEligible = (item = {}) =>
  !isItemLocked(item) && !isWithinWarrantyPeriod(item);

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

const CreateRepair = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);

  const [assignedInventories, setAssignedInventories] = useState([]);
  const [inventoryId, setInventoryId] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [browseSelectedIds, setBrowseSelectedIds] = useState([]);
  const [repairListItems, setRepairListItems] = useState([]);
  const [repairSelectedIds, setRepairSelectedIds] = useState([]);
  const [activeView, setActiveView] = useState("browse");
  const [natureOfDamage, setNatureOfDamage] = useState("");
  const [contactPersonUserId, setContactPersonUserId] = useState("");
  const [contactPersonExtension, setContactPersonExtension] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [departmentUsers, setDepartmentUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [officerProfile, setOfficerProfile] = useState({});
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  const repairListPath = role ? `/inventory/repairs/list/${role}` : "/inventory/repairs/list";

  useEffect(() => {
    let isMounted = true;
    const storedUser = getStoredUser();
    const searchParams = new URLSearchParams();
    if (storedUser.email) {
      searchParams.set("email", storedUser.email);
    } else if (storedUser.id) {
      searchParams.set("userId", storedUser.id);
    }

    const loadProfile = async () => {
      if (!storedUser.email && !storedUser.id) {
        setOfficerProfile(storedUser);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile?${searchParams.toString()}`);
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success && isMounted) {
          setOfficerProfile({ ...storedUser, ...data.profile });
        } else if (isMounted) {
          setOfficerProfile(storedUser);
        }
      } catch {
        if (isMounted) setOfficerProfile(storedUser);
      }
    };

    loadProfile();
    return () => { isMounted = false; };
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

  const selectedInventory = useMemo(
    () => assignedInventories.find((entry) => String(entry.id) === String(inventoryId)) || null,
    [assignedInventories, inventoryId]
  );

  useEffect(() => {
    if (!selectedInventory?.department) {
      setDepartmentUsers([]);
      setContactPersonUserId("");
      setContactPersonExtension("");
      return undefined;
    }

    let isMounted = true;

    const loadDepartmentUsers = async () => {
      try {
        setUsersLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/users`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to load department users.");
        }

        const departmentName = String(selectedInventory.department || "").trim().toLowerCase();
        const filtered = (data.users || []).filter((user) =>
          String(user.department || "").trim().toLowerCase() === departmentName
          && String(user.status || "").toLowerCase() === "active"
        );

        if (isMounted) {
          setDepartmentUsers(filtered);
        }
      } catch {
        if (isMounted) {
          setDepartmentUsers([]);
        }
      } finally {
        if (isMounted) {
          setUsersLoading(false);
        }
      }
    };

    loadDepartmentUsers();
    return () => { isMounted = false; };
  }, [selectedInventory?.department]);

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
    () => browseRows.filter((row) => isRepairEligible(row)),
    [browseRows]
  );

  const repairListRows = useMemo(
    () => repairListItems.map((item) => ({ ...item, _item: item })),
    [repairListItems]
  );

  const contactPersonOptions = useMemo(
    () =>
      departmentUsers.map((user) => ({
        value: String(user.id),
        label: user.officeExtNo ? `${user.name} (Ext: ${user.officeExtNo})` : user.name,
      })),
    [departmentUsers]
  );

  const selectedContactPerson = useMemo(
    () => departmentUsers.find((user) => String(user.id) === String(contactPersonUserId)) || null,
    [departmentUsers, contactPersonUserId]
  );

  const itemsToSubmit = useMemo(
    () => repairListItems.filter((item) => repairSelectedIds.includes(item.id)),
    [repairListItems, repairSelectedIds]
  );

  const canPreviewForm = Boolean(
    selectedInventory
    && itemsToSubmit.length > 0
    && natureOfDamage.trim()
    && contactPersonUserId
  );

  const canSubmit = canPreviewForm;

  const handlePrintForm = () => window.print();

  const handleContactPersonChange = (value) => {
    setContactPersonUserId(value);
    const user = departmentUsers.find((entry) => String(entry.id) === String(value));
    setContactPersonExtension(user?.officeExtNo ? String(user.officeExtNo) : "");
  };

  const toggleBrowseSelection = (itemId) => {
    const item = inventoryItems.find((entry) => entry.id === itemId);
    if (!isRepairEligible(item)) return;
    setBrowseSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleRepairSelection = (itemId) => {
    setRepairSelectedIds((prev) =>
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

  const handleSelectAllRepairList = () => {
    const visibleIds = repairListRows.map((row) => row.id);
    const allSelected = visibleIds.every((id) => repairSelectedIds.includes(id));
    if (allSelected) {
      setRepairSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setRepairSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleAddToRepairList = () => {
    const selectedItems = inventoryItems.filter(
      (item) => browseSelectedIds.includes(item.id) && isRepairEligible(item)
    );
    setRepairListItems((prev) => {
      const existingIds = new Set(prev.map((item) => item.id));
      const nextItems = [...prev];
      selectedItems.forEach((item) => {
        if (!existingIds.has(item.id)) nextItems.push(item);
      });
      return nextItems;
    });
    setBrowseSelectedIds([]);
  };

  const handleRemoveFromRepairList = () => {
    setRepairListItems((prev) => prev.filter((item) => !repairSelectedIds.includes(item.id)));
    setRepairSelectedIds([]);
  };

  const handleInventoryChange = (value) => {
    setInventoryId(value);
    setRepairListItems([]);
    setRepairSelectedIds([]);
    setBrowseSelectedIds([]);
    setContactPersonUserId("");
    setContactPersonExtension("");
    setActiveView("browse");
  };

  const handleSubmitRepair = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitMessage("");

    const storedUser = getStoredUser();
    const initiatedById = Number(storedUser.id ?? 0);
    const selectedItems = repairListItems.filter(
      (item) => repairSelectedIds.includes(item.id) && isRepairEligible(item)
    );

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      setSubmitError("Your session is missing a user id. Please sign in again.");
      return;
    }
    if (selectedItems.length === 0) {
      setSubmitError("Select at least one item from the repair list to submit.");
      return;
    }
    if (!natureOfDamage.trim()) {
      setSubmitError("Nature of damage is required.");
      return;
    }
    if (!contactPersonUserId) {
      setSubmitError("Please select a contact person from your department.");
      return;
    }

    const confirmed = window.confirm(
      "Submit repair request for the selected item(s)?\n\n" +
      "This will also prevent the selected item(s) from being included in transfer or disposal workflows while the repair request is active."
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/api/item-repairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiatedById,
          inventoryId: Number(inventoryId),
          faultDescription: natureOfDamage.trim(),
          repairNotes: additionalNotes.trim(),
          contactPersonUserId: Number(contactPersonUserId),
          items: selectedItems.map((item) => ({ itemId: item.id, quantity: 1 })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to submit repair request.");
      }

      setSubmitMessage(data.message || "Repair request submitted successfully. The selected item(s) are now reserved from transfer and disposal workflows.");
      setTimeout(() => navigate(repairListPath), 1200);
    } catch (error) {
      setSubmitError(error.message || "Failed to submit repair request.");
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
          disabled={!isRepairEligible(row)}
          onChange={() => toggleBrowseSelection(row.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${row.itemName}`}
        />
      ),
    },
    { field: "itemName", label: "Item Name", sortable: true },
    { field: "itemCode", label: "Item Code", sortable: true },
    { field: "serialNo", label: "Serial No.", sortable: true },
    {
      field: "availabilityStatus",
      label: "Status",
      sortable: true,
      render: (value) => renderAvailabilityStatus(value),
    },
  ];

  const repairListColumns = [
    {
      field: "selected",
      label: (
        <input
          type="checkbox"
          checked={repairListRows.length > 0 && repairListRows.every((row) => repairSelectedIds.includes(row.id))}
          onChange={handleSelectAllRepairList}
          aria-label="Select all repair list items"
        />
      ),
      sortable: false,
      render: (_value, row) => (
        <input
          type="checkbox"
          checked={repairSelectedIds.includes(row.id)}
          onChange={() => toggleRepairSelection(row.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Include ${row.itemName} in repair`}
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
        title="Create Repair Request"
        subtitle="Select items, enter repair details, preview the official form, then submit."
        actions={<Button variant="secondary" onClick={() => navigate(repairListPath)}>Back to Repairs</Button>}
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
          {!optionsLoading && inventoryOptions.length === 0 ? (
            <p className="mt-4 text-sm text-text-light">No assigned inventories were found for your account.</p>
          ) : null}
        </Card>

        {inventoryId ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button variant={activeView === "browse" ? "primary" : "secondary"} onClick={() => setActiveView("browse")}>
                Browse Items
              </Button>
              <Button
                variant={activeView === "repair-list" ? "primary" : "secondary"}
                onClick={() => setActiveView("repair-list")}
                icon="playlist_add_check"
              >
                View Repair List ({repairListItems.length})
              </Button>
            </div>

            {activeView === "browse" ? (
              <Card
                title="Inventory Items"
                icon="search"
                subtitle="Search and select items to add to the repair list. Items within the warranty period cannot be selected — use Warranty Claims instead."
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
                    <Button variant="primary" icon="playlist_add" onClick={handleAddToRepairList} disabled={browseSelectedIds.length === 0}>
                      Add to Repair List
                    </Button>
                  </div>
                  <Table
                    columns={browseColumns}
                    data={browseRows}
                    onRowClick={(row) => toggleBrowseSelection(row.id)}
                    isRowDisabled={(row) => !isRepairEligible(row)}
                    loading={itemsLoading}
                    searchable={false}
                    paginated={browseRows.length > 10}
                    itemsPerPage={10}
                  />
                </div>
              </Card>
            ) : (
              <Card title="Repair List" icon="handyman" subtitle="Review staged items, complete repair details, and generate the official form.">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-light">
                      {repairSelectedIds.length} of {repairListItems.length} staged item
                      {repairListItems.length === 1 ? "" : "s"} selected
                    </p>
                    <Button variant="secondary" onClick={handleRemoveFromRepairList} disabled={repairSelectedIds.length === 0}>
                      Remove Selected
                    </Button>
                  </div>
                  <Table
                    columns={repairListColumns}
                    data={repairListRows}
                    onRowClick={(row) => toggleRepairSelection(row.id)}
                    searchable
                    paginated={repairListRows.length > 10}
                    itemsPerPage={10}
                  />

                  {repairListItems.length > 0 ? (
                    <div className="border-t border-border-lighter pt-6 space-y-6">
                      <form onSubmit={handleSubmitRepair} className="space-y-6">
                        <FormInput
                          label="Nature of Damage"
                          name="natureOfDamage"
                          type="textarea"
                          placeholder="Describe the nature of damage..."
                          value={natureOfDamage}
                          onChange={(event) => setNatureOfDamage(event.target.value)}
                          required
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Select
                            label="Contact Person"
                            name="contactPersonUserId"
                            options={contactPersonOptions}
                            value={contactPersonUserId}
                            onChange={handleContactPersonChange}
                            placeholder={usersLoading ? "Loading department users..." : "Select contact person"}
                            required
                            disabled={usersLoading || contactPersonOptions.length === 0}
                          />
                          <FormInput
                            label="Contact Person Extension"
                            name="contactPersonExtension"
                            value={contactPersonExtension}
                            disabled
                            placeholder="Auto-filled from selected user"
                          />
                        </div>

                        {!usersLoading && contactPersonOptions.length === 0 ? (
                          <p className="text-sm text-text-light">No active users were found for this inventory department.</p>
                        ) : null}

                        <FormInput
                          label="Additional Notes"
                          name="additionalNotes"
                          type="textarea"
                          placeholder="Any additional notes for internal records..."
                          value={additionalNotes}
                          onChange={(event) => setAdditionalNotes(event.target.value)}
                        />

                        {canPreviewForm ? (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold text-text-dark">Equipment Repair Requisition Form — Preview</h4>
                              <Button type="button" variant="secondary" icon="print" onClick={handlePrintForm}>Print Form</Button>
                            </div>
                            <RepairSubmissionForm
                              inventory={selectedInventory}
                              items={itemsToSubmit}
                              faultDescription={natureOfDamage}
                              officerName={officerProfile.name || officerProfile.fullName || "—"}
                              officerPost={officerProfile.designation || "Inventory Officer"}
                              officerMobileNo={officerProfile.mobileNo || ""}
                              officerExtensionNo={officerProfile.officeExtNo || ""}
                              contactPersonName={selectedContactPerson?.name || ""}
                              contactPersonExtension={contactPersonExtension || selectedContactPerson?.officeExtNo || ""}
                              contactPersonLocation={selectedContactPerson?.location || ""}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-text-light">
                            Select at least one item, enter nature of damage, and choose a contact person to preview the repair form.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3">
                          <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting || !canSubmit}>
                            Submit Repair Request
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => navigate(repairListPath)} disabled={isSubmitting}>
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

export default CreateRepair;
