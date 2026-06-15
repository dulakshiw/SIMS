export const STORE_ROOM_LOCATION_KEYS = new Set([
  "store room",
  "stores",
  "storage",
  "storeroom",
]);

const PRESERVED_ITEM_STATUSES = new Set([
  "maintenance",
  "damaged",
  "disposed",
  "returned",
]);

export const normalizeLocationKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export const isStoreRoomLocation = (location) => {
  const key = normalizeLocationKey(location);
  return !key || STORE_ROOM_LOCATION_KEYS.has(key);
};

export const shouldPreserveItemStatus = (status) =>
  PRESERVED_ITEM_STATUSES.has(String(status || "").trim().toLowerCase());

export const buildUsersByNameMap = (users = []) => {
  const map = new Map();

  users.forEach((user) => {
    const key = normalizeLocationKey(user.name);
    if (key) {
      map.set(key, user);
    }
  });

  return map;
};

export const resolveItemLocationContext = (item = {}, usersByName = new Map()) => {
  const rawStatus = String(item.status || "available").trim().toLowerCase();
  const location = String(item.location || "").trim();
  const locationKey = normalizeLocationKey(location);
  const matchedUser = locationKey ? usersByName.get(locationKey) : null;

  if (shouldPreserveItemStatus(rawStatus)) {
    return {
      status: rawStatus,
      displayStatus: rawStatus,
      statusLabel: null,
      locationLabel: location || "—",
      issuedTo: matchedUser || null,
      issuedToUserId: matchedUser
        ? Number(matchedUser.id ?? matchedUser.user_id ?? matchedUser.userId ?? 0) || null
        : null,
      issuedToName: matchedUser?.name || null,
      locationKind: "preserved",
    };
  }

  if (matchedUser) {
    const issuedToName = matchedUser.name || location;

    return {
      status: "in-use",
      displayStatus: "issued",
      statusLabel: `Issued to ${issuedToName}`,
      locationLabel: issuedToName,
      issuedTo: matchedUser,
      issuedToUserId: Number(matchedUser.id ?? matchedUser.user_id ?? matchedUser.userId ?? 0) || null,
      issuedToName,
      locationKind: "person",
    };
  }

  if (isStoreRoomLocation(location)) {
    return {
      status: "available",
      displayStatus: "available",
      statusLabel: null,
      locationLabel: location || "Store Room",
      issuedTo: null,
      issuedToUserId: null,
      issuedToName: null,
      locationKind: "store",
    };
  }

  if (location) {
    return {
      status: "in-use",
      displayStatus: "in-use",
      statusLabel: null,
      locationLabel: location,
      issuedTo: null,
      issuedToUserId: null,
      issuedToName: null,
      locationKind: "place",
    };
  }

  return {
    status: rawStatus || "available",
    displayStatus: rawStatus || "available",
    statusLabel: null,
    locationLabel: location || "—",
    issuedTo: null,
    issuedToUserId: null,
    issuedToName: null,
    locationKind: "unknown",
  };
};

export const applyItemLocationContext = (item = {}, usersByName = new Map()) => {
  const context = resolveItemLocationContext(item, usersByName);

  return {
    ...item,
    status: context.status,
    displayStatus: context.displayStatus,
    statusLabel: context.statusLabel,
    locationLabel: context.locationLabel,
    issuedToUserId: context.issuedToUserId,
    issuedToName: context.issuedToName,
    locationKind: context.locationKind,
  };
};

export const deriveItemStatusFromLocation = (location, usersByName, existingStatus = "") =>
  resolveItemLocationContext({ location, status: existingStatus }, usersByName).status;
