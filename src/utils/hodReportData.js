export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
};

export const resolveHodUserId = (user = {}) =>
  Number(user.id ?? user.user_id ?? user.userId ?? 0);

export const resolveHodProfile = async (apiBaseUrl) => {
  const storedUser = getStoredUser();
  const fallbackUserId = resolveHodUserId(storedUser);
  const searchParams = new URLSearchParams();

  if (storedUser.email) {
    searchParams.set("email", storedUser.email);
  } else if (fallbackUserId > 0) {
    searchParams.set("userId", String(fallbackUserId));
  } else {
    return {
      hodUserId: 0,
      profile: storedUser,
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/profile?${searchParams.toString()}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.success || !payload.profile) {
      return {
        hodUserId: fallbackUserId,
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
      hodUserId: resolveHodUserId(profile),
      profile,
    };
  } catch {
    return {
      hodUserId: fallbackUserId,
      profile: storedUser,
    };
  }
};

export const fetchHodLiveReports = async (apiBaseUrl, hodUserId) => {
  const response = await fetch(`${apiBaseUrl}/api/hod/reports?hodUserId=${hodUserId}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || payload.error || "Failed to load department reports.");
  }

  return {
    departmentName: payload.departmentName || "",
    reports: payload.reports || {
      summary: {
        totalUsers: 0,
        totalInventories: 0,
        totalAssets: 0,
        totalValue: "0.00",
        issuedToStaffCount: 0,
      },
      departmentUsers: [],
      inventories: [],
      assets: [],
      issuedItems: [],
    },
  };
};
