/**
 * Format date to readable string
 */
export const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format date and time
 */
export const formatDateTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${formatDate(d)} ${time}`;
};

/**
 * Format currency
 */
export const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

/**
 * Format number with thousand separator
 */
export const formatNumber = (num) => {
  return new Intl.NumberFormat("en-US").format(num);
};

/**
 * Capitalize first letter
 */
export const capitalize = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Get initials from name
 */
export const getInitials = (name) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .join("")
    .substring(0, 2);
};

/**
 * Truncate text
 */
export const truncateText = (text, length = 50) => {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
};

/**
 * Generate random ID
 */
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * Check if object is empty
 */
export const isEmpty = (obj) => {
  return Object.keys(obj).length === 0;
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Debounce function
 */
export const debounce = (func, delay = 300) => {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, delay = 300) => {
  let lastRun = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastRun >= delay) {
      func(...args);
      lastRun = now;
    }
  };
};

/**
 * Get query parameters from URL
 */
export const getQueryParams = (search) => {
  const params = new URLSearchParams(search);
  const obj = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }
  return obj;
};

/**
 * Resolve sidebar variant from route
 * @param {string} pathname - location pathname
 * @param {string} roleParam - optional role param
 * @returns {string} - sidebar variant
 */
export const resolveSidebarVariant = (pathname, roleParam) => {
  if (roleParam) return roleParam;
  if (!pathname) return "inventory";
  if (pathname.startsWith("/incharge")) return "incharge";
  if (pathname.startsWith("/hod")) return "hod";
  if (pathname.startsWith("/dean")) return "dean";
  if (pathname.startsWith("/staff")) return "staff";
  return "inventory";
};

/**
 * Build query string
 */
export const buildQueryString = (obj) => {
  return Object.keys(obj)
    .filter((key) => obj[key] !== null && obj[key] !== undefined && obj[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
    .join("&");
};

/**
 * Local storage helper
 */
export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Error removing from localStorage:", error);
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error("Error clearing localStorage:", error);
    }
  },
};

/**
 * Session storage helper
 */
export const session = {
  get: (key) => {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error("Error reading from sessionStorage:", error);
      return null;
    }
  },
  set: (key, value) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error writing to sessionStorage:", error);
    }
  },
  remove: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error("Error removing from sessionStorage:", error);
    }
  },
};

/**
 * Clear persisted auth/session information
 */
export const logoutUser = () => {
  try {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("username");
    localStorage.removeItem("userRole");
    sessionStorage.removeItem("currentUser");
    delete window.currentUser;
  } catch (error) {
    console.error("Error during logout:", error);
  }
};

/**
 * Validation helpers
 */
export const validation = {
  email: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  phone: (phone) => {
    const re = /^(\+\d{1,3}[- ]?)?\d{10}$/;
    return re.test(phone);
  },
  password: (password) => {
    return password.length >= 6;
  },
  username: (username) => {
    return username.length >= 3 && username.length <= 20;
  },
};

/**
 * Get status badge color
 */
export const getStatusColor = (status, colorMap) => {
  return colorMap[status] || "#999";
};

/**
 * Calculate depreciation value
 */
export const calculateDepreciation = (originalValue, yearsOld, depreciationRate = 0.1) => {
  const depreciation = originalValue * depreciationRate * yearsOld;
  return Math.max(0, originalValue - depreciation);
};

export default {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatNumber,
  capitalize,
  getInitials,
  truncateText,
  generateId,
  isEmpty,
  deepClone,
  debounce,
  throttle,
  getQueryParams,
  buildQueryString,
  storage,
  session,
  logoutUser,
  validation,
  getStatusColor,
  calculateDepreciation,
};
