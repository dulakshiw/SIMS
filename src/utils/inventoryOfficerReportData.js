const normalizeReportNameKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const parseReportItemValue = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const formatReportCurrency = (value) =>
  parseReportItemValue(value).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const resolveOfficerUserId = (user = {}) =>
  Number(user.id ?? user.user_id ?? user.userId ?? 0);

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

export const resolveOfficerProfile = async (apiBaseUrl) => {
  const storedUser = getStoredUser();
  const fallbackUserId = resolveOfficerUserId(storedUser);
  const searchParams = new URLSearchParams();

  if (storedUser.email) {
    searchParams.set("email", storedUser.email);
  } else if (fallbackUserId > 0) {
    searchParams.set("userId", String(fallbackUserId));
  } else {
    return {
      officerUserId: 0,
      profile: storedUser,
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/profile?${searchParams.toString()}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.success || !payload.profile) {
      return {
        officerUserId: fallbackUserId,
        profile: storedUser,
      };
    }

    const profile = {
      ...storedUser,
      ...payload.profile,
      role: payload.profile.role || storedUser.role,
    };

    localStorage.setItem("currentUser", JSON.stringify(profile));
    window.currentUser = profile;

    return {
      officerUserId: resolveOfficerUserId(profile),
      profile,
    };
  } catch {
    return {
      officerUserId: fallbackUserId,
      profile: storedUser,
    };
  }
};

const mapInventoryRow = (inventory = {}) => ({
  id: inventory.id,
  name: inventory.name || "",
  department: inventory.department || "",
  location: inventory.location || "",
  incharge: inventory.incharge || "",
  hod: inventory.hod || "—",
  description: inventory.description || "",
  status: String(inventory.status || "active").toLowerCase(),
  createdDate: inventory.createdDate || "",
  itemCount: 0,
  totalValue: 0,
});

export const buildInventoryOfficerReports = ({
  assignedInventories = [],
  items = [],
  users = [],
}) => {
  const inventoryMap = new Map(
    assignedInventories.map((entry) => [Number(entry.id), { ...entry }])
  );
  const usersByName = new Map();

  users.forEach((user) => {
    const key = normalizeReportNameKey(user.name);
    if (key) {
      usersByName.set(key, user);
    }
  });

  const assetsByInventoryMap = new Map();
  const assetsByCategoryMap = new Map();
  const issuedItems = [];
  let totalAssets = 0;
  let totalValue = 0;

  items.forEach((item) => {
    const inventoryId = Number(item.inventory_id ?? item.inventoryId ?? 0);
    const inventory = inventoryMap.get(inventoryId);
    const itemValue = parseReportItemValue(item.value);
    const category = String(item.itemName || item.item_name || item.name || "Uncategorized").trim()
      || "Uncategorized";
    const categoryKey = category.toLowerCase();
    const status = String(item.status || "").trim().toLowerCase();
    const location = String(item.location || "").trim();
    const locationKey = normalizeReportNameKey(location);
    const matchedUser = locationKey ? usersByName.get(locationKey) : null;

    totalAssets += 1;
    totalValue += itemValue;

    if (inventory) {
      inventory.itemCount += 1;
      inventory.totalValue += itemValue;

      const inventorySummary = assetsByInventoryMap.get(inventoryId) || {
        inventoryId,
        inventoryName: inventory.name,
        location: inventory.location,
        department: inventory.department,
        itemCount: 0,
        totalValue: 0,
      };
      inventorySummary.itemCount += 1;
      inventorySummary.totalValue += itemValue;
      assetsByInventoryMap.set(inventoryId, inventorySummary);
    }

    const categorySummary = assetsByCategoryMap.get(categoryKey) || {
      category,
      itemCount: 0,
      totalValue: 0,
    };
    categorySummary.itemCount += 1;
    categorySummary.totalValue += itemValue;
    assetsByCategoryMap.set(categoryKey, categorySummary);

    const isIssuedToStaff = status === "in-use" || Boolean(matchedUser);
    if (isIssuedToStaff && location) {
      issuedItems.push({
        itemId: item.id,
        itemName: category,
        itemCode: item.itemCode || item.item_code || "",
        serialNo: item.serialNo || item.serial_no || "",
        inventoryId,
        inventoryName: inventory?.name || "",
        inventoryLocation: inventory?.location || "",
        staffName: matchedUser?.name || location,
        department: matchedUser?.department || matchedUser?.department_name || "—",
        designation: matchedUser?.designation || "—",
        status: item.status || "—",
        value: formatReportCurrency(itemValue),
        location,
      });
    }
  });

  const inventories = [...inventoryMap.values()].map((entry) => ({
    ...entry,
    totalValue: formatReportCurrency(entry.totalValue),
    itemCount: entry.itemCount,
  }));

  const assetsByInventory = [...assetsByInventoryMap.values()]
    .map((entry) => ({
      ...entry,
      totalValue: formatReportCurrency(entry.totalValue),
    }))
    .sort((left, right) => left.inventoryName.localeCompare(right.inventoryName));

  const assetsByCategory = [...assetsByCategoryMap.values()]
    .map((entry) => ({
      category: entry.category,
      itemCount: entry.itemCount,
      totalValue: formatReportCurrency(entry.totalValue),
      label: `${entry.category} - ${entry.itemCount}`,
    }))
    .sort((left, right) => right.itemCount - left.itemCount || left.category.localeCompare(right.category));

  issuedItems.sort((left, right) =>
    left.staffName.localeCompare(right.staffName, undefined, { sensitivity: "base" })
    || left.itemName.localeCompare(right.itemName, undefined, { sensitivity: "base" })
  );

  return {
    summary: {
      totalInventories: inventories.length,
      totalAssets,
      totalValue: formatReportCurrency(totalValue),
      issuedToStaffCount: issuedItems.length,
    },
    inventories,
    assetsByInventory,
    issuedItems,
    assetsByCategory,
  };
};

export const fetchInventoryOfficerLiveReports = async (apiBaseUrl, officerUserId) => {
  const [inventoriesResponse, usersResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/api/inventories`),
    fetch(`${apiBaseUrl}/api/users`),
  ]);

  const [inventoriesPayload, usersPayload] = await Promise.all([
    inventoriesResponse.json().catch(() => ({})),
    usersResponse.json().catch(() => ({})),
  ]);

  if (!inventoriesResponse.ok || !inventoriesPayload.success) {
    throw new Error(
      inventoriesPayload.error || inventoriesPayload.message || "Failed to load inventories."
    );
  }

  if (!usersResponse.ok || !usersPayload.success) {
    throw new Error(usersPayload.error || usersPayload.message || "Failed to load users.");
  }

  const assignedInventories = (inventoriesPayload.inventories || [])
    .filter((inventory) => String(inventory.inchargeId) === String(officerUserId))
    .map(mapInventoryRow);

  const itemResponses = await Promise.all(
    assignedInventories.map(async (inventory) => {
      const response = await fetch(`${apiBaseUrl}/api/items?inventoryId=${inventory.id}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || payload.message || `Failed to load items for ${inventory.name}.`);
      }

      return (payload.items || []).map((item) => ({
        ...item,
        inventory_id: item.inventory_id ?? inventory.id,
      }));
    })
  );

  return buildInventoryOfficerReports({
    assignedInventories,
    items: itemResponses.flat(),
    users: usersPayload.users || [],
  });
};

export const fetchInventoryOfficerItemRequests = async (apiBaseUrl, officerUserId) => {
  const response = await fetch(
    `${apiBaseUrl}/api/item-requests?inventoryOfficerUserId=${officerUserId}&inventoryOfficerScope=all`
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || payload.error || "Failed to load inventory requests.");
  }

  return payload.requests || [];
};
