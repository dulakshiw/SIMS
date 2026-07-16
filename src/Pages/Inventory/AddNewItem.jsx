import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, PageHeader, Select } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";
import { generateQrDataUrl, getExternalQrImageUrl } from "../../utils/qrCodeUtils";
import {
  ITEM_FORM_OTHER_VALUE,
  ITEM_FUNDING_KNOWN_VALUES,
  ITEM_FUNDING_OPTIONS,
  ITEM_WARRANTY_KNOWN_VALUES,
  ITEM_WARRANTY_OPTIONS,
  LEGACY_FUNDING_VALUES,
  LEGACY_WARRANTY_VALUES,
  resolveItemOptionField,
} from "../../utils/itemFormOptions";
import {
  buildBulkCsvTemplate,
  detectBulkCsvColumnShift,
  parseBulkCsvText,
} from "../../utils/bulkCsvImport";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const resolveUploadUrl = (filePath) => {
  if (!filePath) {
    return "";
  }
  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }
  return `${API_BASE_URL}${filePath.startsWith("/") ? filePath : `/${filePath}`}`;
};
const COMMON_PLACE_OPTIONS = [
  { value: "Store Room", label: "Store Room" },
  { value: "Lecture Hall 1", label: "Lecture Hall 1" },
  { value: "Lecture Hall 2", label: "Lecture Hall 2" },
  { value: "Lecture Hall 3", label: "Lecture Hall 3" },
  { value: "Lecture Hall 4", label: "Lecture Hall 4" },
  { value: "Lecture Hall 5", label: "Lecture Hall 5" },
];

const LOCATION_OTHER_VALUE = "other";
const LOCATION_EXCLUDED_ROLES = new Set(["admin", "registrar"]);

const formatDateInputValue = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const pickItemField = (item, ...keys) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const IDENTIFIER_FIELDS = new Set(["itemCode", "serialNo", "serialNo2"]);
const EMPTY_IDENTIFIER_ERRORS = { itemCode: "", serialNo: "", serialNo2: "" };

const pickBulkField = (item, ...keys) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

const getBulkGinNo = (item) =>
  pickBulkField(item, "ginNo", "ginno", "gin_no", "gin no", "GIN No", "GIN No.");
const getBulkGinKey = (item) => getBulkGinNo(item).toLowerCase();

/** Same GIN No + item code + item name share one item image (mirrors GIN PDF grouping by GIN No). */
const getBulkImageGroupKey = (item) => {
  const gin = getBulkGinKey(item);
  const code = pickBulkField(item, "itemCode", "itemcode").toLowerCase();
  const name = pickBulkField(item, "itemName", "itemname").toLowerCase();
  return `${gin}::${code}::${name}`;
};

const AddNewItem = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const rolePath = role || sidebarVariant || "incharge";
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "{}");
    } catch {
      return {};
    }
  }, []);
  const initialInventoryId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("inventoryId") || "";
  }, [location.search]);
  const editItemId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("editItemId") || "";
  }, [location.search]);
  const isEditMode = Boolean(editItemId);
  const isInchargeMode = role === "incharge" || currentUser.role === "inventory_incharge";
  const [uploadMode, setUploadMode] = useState("single"); // "single" or "bulk"
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkItems, setBulkItems] = useState([]);
  const [bulkGinSystemCache, setBulkGinSystemCache] = useState({});
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkPrintLoading, setBulkPrintLoading] = useState(false);
  const [selectedBulk, setSelectedBulk] = useState({});
  const [selectAllBulk, setSelectAllBulk] = useState(false);
  const [labelLayout, setLabelLayout] = useState('grid'); // 'grid' or 'avery'
  const [assignedInventories, setAssignedInventories] = useState([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState(initialInventoryId);
  const [inventoryLoadError, setInventoryLoadError] = useState("");
  const [systemUsers, setSystemUsers] = useState([]);
  const [usersLoadError, setUsersLoadError] = useState("");
  const [locationAssignmentType, setLocationAssignmentType] = useState("person");
  const [selectedLocationUserId, setSelectedLocationUserId] = useState("");
  const [selectedCommonPlace, setSelectedCommonPlace] = useState("");
  const [locationOtherDetail, setLocationOtherDetail] = useState("");
  
  const [itemData, setItemData] = useState({
    itemName: "",
    itemCode: "",
    serialNo: "",
    serialNo2: "",
    model: "",
    QRCode: "",
    QRCode2: "",
    pageno: "",
    itemImage: null,
    value: "",
    purchaseDate: "",
    ginNo: "",
    ginfile: null,
    poNo: "",
    supplier: "",
    funding: "",
    fundingOther: "",
    receivedfrom: "",
    warranty: "",
    warrantyOther: "",
    location: "",
    remarks: ""
  });
  const [ginExistingFile, setGinExistingFile] = useState("");
  const [ginStatus, setGinStatus] = useState("");
  const [ginCheckLoading, setGinCheckLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [existingItemImage, setExistingItemImage] = useState("");
  const [pendingEditLocation, setPendingEditLocation] = useState("");
  const [identifierErrors, setIdentifierErrors] = useState(EMPTY_IDENTIFIER_ERRORS);
  const [itemNameSuggestions, setItemNameSuggestions] = useState([]);

  useEffect(() => {
    if (!isInchargeMode || !currentUser.id) {
      return undefined;
    }

    let isMounted = true;

    const loadAssignedInventories = async () => {
      try {
        setInventoryLoadError("");
        const response = await fetch(`${API_BASE_URL}/api/inventories`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || "Failed to load assigned inventories.");
        }

        if (!isMounted) {
          return;
        }

        const nextInventories = (data.inventories || []).filter(
          (inventory) => String(inventory.inchargeId) === String(currentUser.id)
        );
        setAssignedInventories(nextInventories);

        if (!selectedInventoryId && nextInventories.length === 1) {
          setSelectedInventoryId(String(nextInventories[0].id));
        }
      } catch (error) {
        if (isMounted) {
          setAssignedInventories([]);
          setInventoryLoadError(error.message || "Failed to load assigned inventories.");
        }
      }
    };

    loadAssignedInventories();
    return () => {
      isMounted = false;
    };
  }, [currentUser.id, isInchargeMode, selectedInventoryId]);

  useEffect(() => {
    let isMounted = true;

    const loadSystemUsers = async () => {
      try {
        setUsersLoadError("");
        const response = await fetch(`${API_BASE_URL}/api/users`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || "Failed to load users.");
        }

        if (!isMounted) {
          return;
        }

        setSystemUsers(data.users || []);
      } catch (error) {
        if (isMounted) {
          setSystemUsers([]);
          setUsersLoadError(error.message || "Failed to load users.");
        }
      }
    };

    loadSystemUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const inventoryOptions = useMemo(
    () => assignedInventories.map((inventory) => ({ value: String(inventory.id), label: `${inventory.name} (${inventory.location || "No location"})` })),
    [assignedInventories]
  );

  const selectedInventory = assignedInventories.find((inventory) => String(inventory.id) === String(selectedInventoryId)) || null;
  const userLocationOptions = useMemo(() => {
    const staffUsers = systemUsers
      .filter((user) => !LOCATION_EXCLUDED_ROLES.has(String(user.role || "").toLowerCase().trim()))
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
      );

    return [
      ...staffUsers.map((user) => ({
        value: String(user.id),
        label:
          user.department && user.department !== "-"
            ? `${user.name} (${user.department})`
            : user.name,
      })),
      { value: LOCATION_OTHER_VALUE, label: "Other (person outside faculty)" },
    ];
  }, [systemUsers]);

  const commonPlaceOptions = useMemo(
    () => [
      ...COMMON_PLACE_OPTIONS,
      { value: LOCATION_OTHER_VALUE, label: "Other (place outside faculty)" },
    ],
    []
  );

  const showLocationOtherInput =
    (locationAssignmentType === "person" && selectedLocationUserId === LOCATION_OTHER_VALUE) ||
    (locationAssignmentType === "place" && selectedCommonPlace === LOCATION_OTHER_VALUE);

  const selectedLocationUser = useMemo(
    () => systemUsers.find((user) => String(user.id) === String(selectedLocationUserId)) || null,
    [selectedLocationUserId, systemUsers]
  );

  const resolveBulkLocationValue = (item) => {
    const locationType = String(item?.bulkLocationType || "csv");
    if (locationType === "csv") {
      return pickBulkField(item, "location");
    }

    if (locationType === "person") {
      const selectedUserId = String(item?.bulkLocationUserId || "");
      if (selectedUserId === LOCATION_OTHER_VALUE) {
        return String(item?.bulkLocationOtherDetail || "").trim();
      }
      const selectedUser = systemUsers.find((user) => String(user.id) === selectedUserId);
      return selectedUser?.name || "";
    }

    if (locationType === "place") {
      const selectedPlace = String(item?.bulkLocationPlace || "");
      if (selectedPlace === LOCATION_OTHER_VALUE) {
        return String(item?.bulkLocationOtherDetail || "").trim();
      }
      return selectedPlace;
    }

    return "";
  };

  const applyLocationFromValue = (locationValue, users) => {
    const normalizedLocation = String(locationValue || "").trim();
    if (!normalizedLocation) {
      return;
    }

    const matchedUser = users.find((user) => String(user.name || "").trim() === normalizedLocation);
    if (matchedUser) {
      setLocationAssignmentType("person");
      setSelectedLocationUserId(String(matchedUser.id));
      setSelectedCommonPlace("");
      setLocationOtherDetail("");
      return;
    }

    const matchedPlace = COMMON_PLACE_OPTIONS.find((place) => place.value === normalizedLocation);
    if (matchedPlace) {
      setLocationAssignmentType("place");
      setSelectedCommonPlace(matchedPlace.value);
      setSelectedLocationUserId("");
      setLocationOtherDetail("");
      return;
    }

    setLocationAssignmentType("person");
    setSelectedLocationUserId(LOCATION_OTHER_VALUE);
    setSelectedCommonPlace("");
    setLocationOtherDetail(normalizedLocation);
  };

  useEffect(() => {
    if (!isEditMode || !editItemId) {
      return undefined;
    }

    let isMounted = true;

    const loadItemForEdit = async () => {
      try {
        setEditLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/items/${editItemId}`);
        const data = await response.json();

        if (!response.ok || !data.success || !data.item) {
          throw new Error(data.error || data.message || "Failed to load item for editing.");
        }

        if (!isMounted) {
          return;
        }

        const item = data.item;
        const fundingRaw =
          LEGACY_FUNDING_VALUES[pickItemField(item, "funding", "funding_source")] ||
          pickItemField(item, "funding", "funding_source");
        const funding = resolveItemOptionField(fundingRaw, ITEM_FUNDING_KNOWN_VALUES);
        const warrantyRaw =
          LEGACY_WARRANTY_VALUES[pickItemField(item, "warranty")] || pickItemField(item, "warranty");
        const warranty = resolveItemOptionField(warrantyRaw, ITEM_WARRANTY_KNOWN_VALUES);
        const ginPath = pickItemField(item, "ginfile", "gin_pdf", "gin_file");
        const imagePath = pickItemField(item, "itemImage", "item_image", "image");

        setItemData({
          itemName: pickItemField(item, "itemName", "item_name", "name"),
          itemCode: pickItemField(item, "itemCode", "item_code"),
          serialNo: pickItemField(item, "serialNo", "serial_no"),
          serialNo2: pickItemField(item, "serialNo2", "serial_no2"),
          model: pickItemField(item, "model"),
          QRCode: pickItemField(item, "QRCode", "qr_code", "qrcode"),
          QRCode2: pickItemField(item, "QRCode2", "qr_code2", "qrcode2"),
          pageno: pickItemField(item, "pageno", "page_no") || "",
          itemImage: null,
          value: item.value ?? "",
          purchaseDate: formatDateInputValue(
            pickItemField(item, "purchaseDate", "purchase_date", "purchased_date")
          ),
          ginNo: pickItemField(item, "ginNo", "gin_no"),
          ginfile: null,
          poNo: pickItemField(item, "poNo", "po_no"),
          supplier: pickItemField(item, "supplier"),
          funding:
            funding.selected === ITEM_FORM_OTHER_VALUE
              ? ITEM_FORM_OTHER_VALUE
              : funding.selected,
          fundingOther:
            funding.selected === ITEM_FORM_OTHER_VALUE
              ? pickItemField(item, "fundingOther", "funding_other") || funding.other
              : "",
          receivedfrom: pickItemField(item, "receivedfrom", "received_from"),
          warranty:
            warranty.selected === ITEM_FORM_OTHER_VALUE
              ? ITEM_FORM_OTHER_VALUE
              : warranty.selected,
          warrantyOther:
            warranty.selected === ITEM_FORM_OTHER_VALUE
              ? pickItemField(item, "warrantyOther", "warranty_other") || warranty.other
              : "",
          location: pickItemField(item, "location"),
          remarks: pickItemField(item, "remarks"),
        });

        if (item.inventory_id) {
          setSelectedInventoryId(String(item.inventory_id));
        }

        setGinExistingFile(ginPath || "");
        setExistingItemImage(imagePath || "");
        setPendingEditLocation(pickItemField(item, "location"));
      } catch (loadError) {
        if (isMounted) {
          alert(loadError.message || "Failed to load item for editing.");
          navigate(`/inventory/item/${editItemId}/${rolePath}`);
        }
      } finally {
        if (isMounted) {
          setEditLoading(false);
        }
      }
    };

    loadItemForEdit();

    return () => {
      isMounted = false;
    };
  }, [isEditMode, editItemId, navigate, rolePath]);

  useEffect(() => {
    if (!isEditMode || !pendingEditLocation || systemUsers.length === 0) {
      return;
    }

    applyLocationFromValue(pendingEditLocation, systemUsers);
    setPendingEditLocation("");
  }, [isEditMode, pendingEditLocation, systemUsers]);

  const applyIdentifierConflicts = (conflicts = {}) => {
    setIdentifierErrors({
      itemCode: conflicts.itemCode || "",
      serialNo: conflicts.serialNo || "",
      serialNo2: conflicts.serialNo2 || "",
    });
    return Object.keys(conflicts).length === 0;
  };

  const checkItemIdentifiers = async (identifiers = itemData) => {
    const params = new URLSearchParams();

    if (String(identifiers.itemCode || "").trim()) {
      params.set("itemCode", String(identifiers.itemCode).trim());
    }
    if (String(identifiers.serialNo || "").trim()) {
      params.set("serialNo", String(identifiers.serialNo).trim());
    }
    if (String(identifiers.serialNo2 || "").trim()) {
      params.set("serialNo2", String(identifiers.serialNo2).trim());
    }
    if (isEditMode && editItemId) {
      params.set("excludeItemId", editItemId);
    }

    if (!params.has("itemCode") && !params.has("serialNo") && !params.has("serialNo2")) {
      setIdentifierErrors(EMPTY_IDENTIFIER_ERRORS);
      return { valid: true, conflicts: {} };
    }

    const response = await fetch(`${API_BASE_URL}/api/item-identifiers/check?${params.toString()}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || "Failed to validate item identifiers.");
    }

    return {
      valid: Boolean(data.valid),
      conflicts: data.conflicts || {},
    };
  };

  const runIdentifierValidation = async (nextItemData = itemData) => {
    try {
      const result = await checkItemIdentifiers(nextItemData);
      applyIdentifierConflicts(result.conflicts);
      return result.valid;
    } catch (validationError) {
      console.error(validationError);
      return false;
    }
  };

  const buildIdentifierCheckPayload = (fieldName, fieldValue, data = itemData) => {
    const latestValues = {
      itemCode: String(data.itemCode ?? "").trim(),
      serialNo: String(data.serialNo ?? "").trim(),
      serialNo2: String(data.serialNo2 ?? "").trim(),
    };
    latestValues[fieldName] = String(fieldValue ?? "").trim();

    const payload = {};

    if (fieldName === "itemCode" && latestValues.itemCode) {
      payload.itemCode = latestValues.itemCode;
      return payload;
    }

    if (fieldName === "serialNo" && latestValues.serialNo) {
      payload.serialNo = latestValues.serialNo;
      if (latestValues.serialNo2) {
        payload.serialNo2 = latestValues.serialNo2;
      }
      return payload;
    }

    if (fieldName === "serialNo2" && latestValues.serialNo2) {
      payload.serialNo2 = latestValues.serialNo2;
      if (latestValues.serialNo) {
        payload.serialNo = latestValues.serialNo;
      }
      return payload;
    }

    return payload;
  };

  const applyFieldIdentifierResult = (fieldName, conflicts = {}) => {
    setIdentifierErrors((prev) => {
      if (fieldName === "itemCode") {
        return { ...prev, itemCode: conflicts.itemCode || "" };
      }

      if (fieldName === "serialNo") {
        return {
          ...prev,
          serialNo: conflicts.serialNo || "",
          serialNo2: Object.prototype.hasOwnProperty.call(conflicts, "serialNo2")
            ? (conflicts.serialNo2 || "")
            : prev.serialNo2,
        };
      }

      return {
        ...prev,
        serialNo: Object.prototype.hasOwnProperty.call(conflicts, "serialNo")
          ? (conflicts.serialNo || "")
          : prev.serialNo,
        serialNo2: conflicts.serialNo2 || "",
      };
    });
  };

  const handleIdentifierBlur = async (e) => {
    const { name, value } = e.target;

    if (!IDENTIFIER_FIELDS.has(name)) {
      return;
    }

    const trimmedValue = String(value ?? "").trim();

    if (!trimmedValue) {
      setIdentifierErrors((prev) => ({ ...prev, [name]: "" }));
      return;
    }

    const payload = buildIdentifierCheckPayload(name, value);

    if (!payload.itemCode && !payload.serialNo && !payload.serialNo2) {
      return;
    }

    try {
      const result = await checkItemIdentifiers(payload);
      applyFieldIdentifierResult(name, result.conflicts);
    } catch (validationError) {
      setIdentifierErrors((prev) => ({
        ...prev,
        [name]: validationError.message || "Unable to verify this value. Restart the API server and try again.",
      }));
    }
  };

  const hasIdentifierErrors = Object.values(identifierErrors).some(Boolean);
  const isItemNameMissing = !String(itemData.itemName || "").trim();
  const isSaveDisabled = hasIdentifierErrors || isItemNameMissing;

  const handleSelectFieldChange = (name) => (value) => {
    handleChange({ target: { name, value } });
  };

  useEffect(() => {
    const query = String(itemData.itemName || "").trim();

    if (!query) {
      setItemNameSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "10" });
        const response = await fetch(`${API_BASE_URL}/api/items/names?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          return;
        }

        setItemNameSuggestions(data.names || []);
      } catch (error) {
        if (error.name !== "AbortError") {
          setItemNameSuggestions([]);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [itemData.itemName]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setItemData((prev) => {
      const next = {
        ...prev,
        [name]: value
      };

      if (name === "funding" && value !== ITEM_FORM_OTHER_VALUE) {
        next.fundingOther = "";
      }

      if (name === "warranty" && value !== ITEM_FORM_OTHER_VALUE) {
        next.warrantyOther = "";
      }

      if (name === "serialNo") {
        const code = String(prev.itemCode || "").trim();
        const serial = String(value || "").trim();
        if (code && (prev.QRCode || serial)) {
          next.QRCode = computeQRCodeValue(code, serial);
        } else if (!serial) {
          next.QRCode = "";
        }
      }

      if (name === "serialNo2" && !String(value || "").trim()) {
        next.QRCode2 = "";
      }

      if (name === "itemCode") {
        const code = String(value || "").trim();
        const serial1 = String(prev.serialNo || "").trim();
        const serial2 = String(prev.serialNo2 || "").trim();
        if (prev.QRCode) {
          next.QRCode = code ? computeQRCodeValue(code, serial1) : "";
        }
        if (prev.QRCode2 && serial2) {
          next.QRCode2 = code ? computeQRCodeValue(code, serial2) : "";
        }
      }

      if (IDENTIFIER_FIELDS.has(name)) {
        setIdentifierErrors((currentErrors) => ({
          ...currentErrors,
          [name]: "",
        }));
      }

      return next;
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];
    const allowedExtensions = [".jpg", ".jpeg", ".png"];
    const validImage =
      allowedImageTypes.includes(file.type) || allowedExtensions.includes(ext);

    if (!validImage) {
      alert("Item image must be a JPG, JPEG, or PNG file.");
      e.target.value = "";
      return;
    }

    setItemData({
      ...itemData,
      itemImage: file
    });
  };

  const handleGinFileChange = (e) => {
    const file = e.target.files[0];
    if (ginExistingFile) {
      e.target.value = "";
      return;
    }

    if (file) {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        alert("GIN PDF must be a .pdf file.");
        e.target.value = "";
        return;
      }
      setItemData({
        ...itemData,
        ginfile: file
      });
    }
  };

  const checkExistingGinFile = async (ginNoValue, signal) => {
    if (!ginNoValue) {
      setGinExistingFile("");
      setGinStatus("");
      setGinCheckLoading(false);
      return;
    }

    setGinCheckLoading(true);
    setGinStatus("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/items?ginNo=${encodeURIComponent(ginNoValue)}`, {
        signal,
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items) && data.items.length > 0) {
        const existing = data.items.find((item) => item.ginfile && item.ginfile.trim() !== "");
        if (existing) {
          setGinExistingFile(existing.ginfile.trim());
          setGinStatus(
            `GIN No "${ginNoValue}" already has a PDF in the system. Upload is not required — this item will reuse the stored file.`
          );
          setItemData((prev) => ({ ...prev, ginfile: null }));
          return;
        }
        setGinExistingFile("");
        setGinStatus(
          `GIN No "${ginNoValue}" exists in the system but has no PDF yet. Upload the GIN PDF once below.`
        );
        return;
      }
      setGinExistingFile("");
      setGinStatus("");
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
      }
      setGinExistingFile("");
      setGinStatus("");
    } finally {
      setGinCheckLoading(false);
    }
  };

  useEffect(() => {
    const ginNoValue = String(itemData.ginNo || "").trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      if (ginNoValue) {
        checkExistingGinFile(ginNoValue, controller.signal);
      } else {
        setGinExistingFile("");
        setGinStatus("");
        setGinCheckLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [itemData.ginNo]);

  // QR payload: item_code + serial_no when serial exists, otherwise item_code only.
  const computeQRCodeValue = (code, serial) => {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) {
      return "";
    }

    const normalizedSerial = String(serial || "").trim();
    if (normalizedSerial) {
      return `${normalizedCode}_${normalizedSerial}`;
    }

    return normalizedCode;
  };

  const buildItemScanUrl = (payload, receivedfrom = "") => {
    if (!payload) {
      return "";
    }

    const params = new URLSearchParams({ q: payload });
    if (receivedfrom) {
      params.set("incharge", receivedfrom);
    }

    return `${window.location.origin}/inventory/scan?${params.toString()}`;
  };

  const buildBulkQrPayload = (item, rowIndex = 0) => {
    const code = pickBulkField(item, "itemCode", "itemcode");
    const serial = pickBulkField(item, "serialNo", "serialno");
    const serial2 = pickBulkField(item, "serialNo2", "serialno2");
    const receivedfrom = pickBulkField(item, "receivedfrom", "receivedFrom");
    const serial2Value = String(serial2 || "").trim();
    const computed = computeQRCodeValue(code, serial);
    const computed2 = serial2Value ? computeQRCodeValue(code, serial2) : "";
    const csvQr = pickBulkField(item, "QRCode", "qrcode");
    const csvQr2 = pickBulkField(item, "QRCode2", "qrcode2");

    const qrcode =
      computed ||
      String(csvQr || item.qrcode || "").trim() ||
      `AUTO_${Date.now()}_${rowIndex}`;
    const qrcode2 = computed2 || String(csvQr2 || item.qrcode2 || "").trim();

    return {
      qrcode,
      qrcode2,
      qrcodeUrl: buildItemScanUrl(qrcode, receivedfrom),
      qrcode2Url: buildItemScanUrl(qrcode2, receivedfrom),
    };
  };

  const escapePrintHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const buildBulkPrintLabelEntries = async (items, imageSize = 200) => {
    const entries = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const qr = buildBulkQrPayload(item, index);
      const name = pickBulkField(item, "itemName", "itemname");
      const code = pickBulkField(item, "itemCode", "itemcode");
      const serial = pickBulkField(item, "serialNo", "serialno");
      const serial2 = pickBulkField(item, "serialNo2", "serialno2");
      const receivedfrom = pickBulkField(item, "receivedfrom", "receivedFrom");

      const labelJobs = [
        { payload: qr.qrcode, serialLabel: serial, scanUrl: qr.qrcodeUrl },
        { payload: qr.qrcode2, serialLabel: serial2, scanUrl: qr.qrcode2Url },
      ];

      for (const { payload, serialLabel, scanUrl } of labelJobs) {
        if (!payload) {
          continue;
        }

        const resolvedScanUrl = scanUrl || buildItemScanUrl(payload, receivedfrom);
        const qrImageUrl = await generateQrDataUrl(resolvedScanUrl, imageSize);

        if (!qrImageUrl) {
          continue;
        }

        entries.push({
          name,
          code,
          serial: serialLabel,
          qrImageUrl,
        });
      }
    }

    return entries;
  };

  const openQrLabelPrintWindow = (labelEntries, layout = "grid") => {
    const w = window.open("", "_blank");
    if (!w) {
      alert("Unable to open print window. Please allow popups.");
      return;
    }

    const cardHtml = labelEntries
      .map((entry) => {
        const { qrImageUrl, name, code, serial } = entry;
        const safeName = escapePrintHtml(name);
        const safeCode = escapePrintHtml(code);
        const safeSerial = escapePrintHtml(serial);

        if (layout === "avery") {
          return `
            <div style="width:180px;height:110px;display:inline-block;margin:6px;padding:6px;border:0;box-sizing:border-box;text-align:center;font-family:Arial,Helvetica,sans-serif;vertical-align:top">
              <img src="${qrImageUrl}" alt="QR code" style="width:86px;height:86px;object-fit:contain;display:block;margin:0 auto" />
              <div style="margin-top:6px;font-weight:600;font-size:11px">${safeName}</div>
              <div style="font-size:10px;color:#444">${safeCode}${safeSerial ? ` | ${safeSerial}` : ""}</div>
            </div>
          `;
        }

        return `
          <div style="width:240px;height:320px;display:inline-block;margin:8px;padding:8px;border:1px solid #e5e7eb;box-sizing:border-box;text-align:center;font-family:Arial,Helvetica,sans-serif">
            <img src="${qrImageUrl}" alt="QR code" style="width:200px;height:200px;object-fit:contain" />
            <div style="margin-top:8px;font-weight:600">${safeName}</div>
            <div style="font-size:12px;color:#444">${safeCode}${safeSerial ? ` | ${safeSerial}` : ""}</div>
          </div>
        `;
      })
      .join("\n");

    w.document.write(
      `<!doctype html><html><head><title>QR Labels</title><style>body{padding:20px}@media print{body{padding:0}}</style></head><body>${cardHtml}</body></html>`
    );
    w.document.close();

    const triggerPrint = () => {
      w.focus();
      w.print();
    };

    const images = Array.from(w.document.images || []);
    if (images.length === 0) {
      triggerPrint();
      return;
    }

    const allImagesReady = () =>
      images.every((img) => img.complete && img.naturalWidth > 0);

    if (allImagesReady()) {
      triggerPrint();
      return;
    }

    let settledCount = 0;
    const tryPrintWhenReady = () => {
      settledCount += 1;
      if (allImagesReady() || settledCount >= images.length) {
        triggerPrint();
      }
    };

    images.forEach((img) => {
      img.addEventListener("load", tryPrintWhenReady, { once: true });
      img.addEventListener("error", tryPrintWhenReady, { once: true });
    });

    window.setTimeout(() => {
      if (!w.closed) {
        triggerPrint();
      }
    }, 500);
  };

  const generateAndSetQRCode = (slot = 1, force = false) => {
    const code = itemData.itemCode && itemData.itemCode.trim();
    const serial =
      slot === 1
        ? itemData.serialNo && itemData.serialNo.trim()
        : itemData.serialNo2 && itemData.serialNo2.trim();
    const qrField = slot === 1 ? "QRCode" : "QRCode2";
    const serialLabel = slot === 1 ? "Serial No" : "Serial No 2";

    if (slot === 2 && !serial) {
      alert(`Please enter ${serialLabel} before generating QR Code (Serial No 2).`);
      return;
    }

    const computed = computeQRCodeValue(code, serial);

    if (computed) {
      setItemData((prev) => ({ ...prev, [qrField]: computed }));
      return;
    }

    if (force) {
      const fallback = `AUTO_SN${slot}_${Date.now()}`;
      setItemData((prev) => ({ ...prev, [qrField]: fallback }));
      return;
    }

    alert(
      `Please provide Item Code before generating this QR code. When ${serialLabel} is filled it will be appended as item_code_serial_no; otherwise only the item code is used (e.g. furniture). Use "Force generate" only if Item Code is missing.`
    );
  };

  const handlePrintQr = async () => {
    const code = itemData.itemCode && itemData.itemCode.trim();
    const serial = itemData.serialNo && itemData.serialNo.trim();
    const serial2 = itemData.serialNo2 && itemData.serialNo2.trim();
    const name = itemData.itemName && itemData.itemName.trim();
    const payload =
      (itemData.QRCode && itemData.QRCode.trim()) || computeQRCodeValue(code, serial);
    const payload2 =
      serial2 &&
      ((itemData.QRCode2 && itemData.QRCode2.trim()) || computeQRCodeValue(code, serial2));

    if (!payload && !payload2) {
      alert("No data available to generate QR. Please provide Item Code (and Serial No 2 if printing the second QR).");
      return;
    }

    const labelEntries = [];

    if (payload) {
      const scanUrl = buildItemScanUrl(payload, itemData.receivedfrom || "");
      const qrImageUrl = await generateQrDataUrl(scanUrl, 300);
      if (qrImageUrl) {
        labelEntries.push({
          name: name || "",
          code: code || "",
          serial,
          qrImageUrl,
        });
      }
    }

    if (payload2) {
      const scanUrl = buildItemScanUrl(payload2, itemData.receivedfrom || "");
      const qrImageUrl = await generateQrDataUrl(scanUrl, 300);
      if (qrImageUrl) {
        labelEntries.push({
          name: name || "",
          code: code || "",
          serial: serial2,
          qrImageUrl,
        });
      }
    }

    if (labelEntries.length === 0) {
      alert("Unable to generate QR images for printing.");
      return;
    }

    openQrLabelPrintWindow(labelEntries, "grid");
  };

  const updateBulkItemAt = (index, patch) => {
    setBulkItems((prev) => prev.map((row, rowIndex) => (
      rowIndex === index ? { ...row, ...patch } : row
    )));
  };

  const loadBulkGinSystemCache = async (items) => {
    const uniqueGinKeys = [...new Set(items.map((item) => getBulkGinKey(item)).filter(Boolean))];
    const cache = {};

    await Promise.all(uniqueGinKeys.map(async (ginKey) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items?ginNo=${encodeURIComponent(ginKey)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.items)) {
          const existing = data.items.find((item) => item.ginfile && String(item.ginfile).trim() !== "");
          cache[ginKey] = existing ? String(existing.ginfile).trim() : null;
        } else {
          cache[ginKey] = null;
        }
      } catch {
        cache[ginKey] = null;
      }
    }));

    setBulkGinSystemCache(cache);
    setBulkItems((prev) => prev.map((row) => {
      const ginKey = getBulkGinKey(row);
      const systemPath = ginKey ? cache[ginKey] : null;
      return systemPath
        ? { ...row, existingGinfile: systemPath, ginfile: null }
        : row;
    }));
  };

  const getBulkGinSourceIndex = (ginKey, items = bulkItems) => {
    if (!ginKey) {
      return -1;
    }

    if (bulkGinSystemCache[ginKey]) {
      return -1;
    }

    return items.findIndex(
      (row) => getBulkGinKey(row) === ginKey && (row.ginfile instanceof File || row.existingGinfile)
    );
  };

  const getFirstBulkGinRowIndex = (ginKey, items = bulkItems) => (
    items.findIndex((row) => getBulkGinKey(row) === ginKey)
  );

  const isBulkGinUploadDisabled = (index, items = bulkItems) => {
    const item = items[index];
    const ginKey = getBulkGinKey(item);

    if (!ginKey) {
      return false;
    }

    if (bulkGinSystemCache[ginKey]) {
      return true;
    }

    const sourceIndex = getBulkGinSourceIndex(ginKey, items);
    if (sourceIndex >= 0 && sourceIndex !== index) {
      return true;
    }

    const firstIndex = getFirstBulkGinRowIndex(ginKey, items);
    return firstIndex >= 0 && firstIndex !== index;
  };

  const getBulkGinStatus = (index, items = bulkItems) => {
    const item = items[index];
    const ginKey = getBulkGinKey(item);

    if (!ginKey) {
      return item.ginfile instanceof File ? "PDF attached" : "No GIN No in CSV";
    }

    const systemPath = bulkGinSystemCache[ginKey];
    if (systemPath) {
      return "Reuses stored GIN PDF";
    }

    const sourceIndex = getBulkGinSourceIndex(ginKey, items);
    if (sourceIndex === index && item.ginfile instanceof File) {
      return "PDF attached (shared for this GIN)";
    }

    if (sourceIndex >= 0 && sourceIndex !== index) {
      return "Uses GIN PDF from first row";
    }

    if (isBulkGinUploadDisabled(index, items)) {
      return "Upload on first row with this GIN";
    }

    return item.ginfile instanceof File ? "PDF attached" : "Upload required";
  };

  const getBulkImageSourceIndex = (groupKey, items = bulkItems) => {
    if (!groupKey) {
      return -1;
    }

    return items.findIndex(
      (row) =>
        getBulkImageGroupKey(row) === groupKey &&
        (
          row.itemImage instanceof File ||
          (typeof row.existingItemImage === "string" && row.existingItemImage.trim().startsWith("/uploads/"))
        )
    );
  };

  const getFirstBulkImageRowIndex = (groupKey, items = bulkItems) => (
    items.findIndex((row) => getBulkImageGroupKey(row) === groupKey)
  );

  const isBulkImageUploadDisabled = (index, items = bulkItems) => {
    const item = items[index];
    const groupKey = getBulkImageGroupKey(item);

    if (!groupKey.replace(/::/g, "").trim()) {
      return false;
    }

    const sourceIndex = getBulkImageSourceIndex(groupKey, items);
    if (sourceIndex >= 0 && sourceIndex !== index) {
      return true;
    }

    const firstIndex = getFirstBulkImageRowIndex(groupKey, items);
    return firstIndex >= 0 && firstIndex !== index;
  };

  const getBulkImageStatus = (index, items = bulkItems) => {
    const item = items[index];
    const groupKey = getBulkImageGroupKey(item);

    if (!groupKey.replace(/::/g, "").trim()) {
      return item.itemImage instanceof File ? "Image attached" : "Optional";
    }

    if (typeof item.existingItemImage === "string" && item.existingItemImage.trim().startsWith("/uploads/")) {
      return "Reuses linked image";
    }

    const sourceIndex = getBulkImageSourceIndex(groupKey, items);

    if (sourceIndex === index) {
      return "Image attached (shared for matching rows)";
    }

    if (sourceIndex >= 0 && sourceIndex !== index) {
      return "Uses image from first matching row";
    }

    if (isBulkImageUploadDisabled(index, items)) {
      return "Upload on first row with same GIN, item code & name";
    }

    return item.itemImage instanceof File ? "Image attached" : "Optional";
  };

  const handleBulkGinFileChange = (index, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (file.type !== "application/pdf" && ext !== ".pdf") {
      alert("GIN PDF must be a .pdf file.");
      return;
    }

    updateBulkItemAt(index, { ginfile: file, existingGinfile: "" });
  };

  const handleBulkImageFileChange = (index, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];
    const allowedExtensions = [".jpg", ".jpeg", ".png"];
    const validImage = allowedImageTypes.includes(file.type) || allowedExtensions.includes(ext);

    if (!validImage) {
      alert("Item image must be a JPG, JPEG, or PNG file.");
      return;
    }

    updateBulkItemAt(index, { itemImage: file, existingItemImage: "" });
  };

  const resolveBulkGinSource = (item, items = bulkItems) => {
    const ginKey = getBulkGinKey(item);

    if (!ginKey) {
      return item;
    }

    const systemPath = bulkGinSystemCache[ginKey];
    if (systemPath) {
      return { ...item, existingGinfile: systemPath, ginfile: null };
    }

    const sourceIndex = getBulkGinSourceIndex(ginKey, items);
    if (sourceIndex >= 0) {
      return items[sourceIndex];
    }

    const firstIndex = getFirstBulkGinRowIndex(ginKey, items);
    if (firstIndex >= 0) {
      return items[firstIndex];
    }

    return item;
  };

  const resolveBulkImageSource = (item, items = bulkItems, linkedImagePath = "") => {
    if (typeof linkedImagePath === "string" && linkedImagePath.trim().startsWith("/uploads/")) {
      return { ...item, existingItemImage: linkedImagePath, itemImage: null };
    }

    if (typeof item.existingItemImage === "string" && item.existingItemImage.trim().startsWith("/uploads/")) {
      return item;
    }

    const groupKey = getBulkImageGroupKey(item);
    const sourceIndex = getBulkImageSourceIndex(groupKey, items);

    if (sourceIndex >= 0) {
      return items[sourceIndex];
    }

    const firstIndex = getFirstBulkImageRowIndex(groupKey, items);
    return firstIndex >= 0 ? items[firstIndex] : item;
  };

  const buildBulkItemFormData = (item, items = bulkItems, index = 0, linkedImagePath = "") => {
    const ginSource = resolveBulkGinSource(item, items);
    const imageSource = resolveBulkImageSource(item, items, linkedImagePath);
    const qr = buildBulkQrPayload(item, index);
    const fundingOtherValue = pickBulkField(item, "fundingOther", "fundingother");
    const warrantyOtherValue = pickBulkField(item, "warrantyOther", "warrantyother");
    const fundingValue = pickBulkField(item, "funding");
    const warrantyValue = pickBulkField(item, "warranty");
    const normalizedFunding =
      fundingValue === ITEM_FORM_OTHER_VALUE ? fundingOtherValue : fundingValue;
    const normalizedWarranty =
      warrantyValue === ITEM_FORM_OTHER_VALUE ? warrantyOtherValue : warrantyValue;

    const form = new FormData();
    form.append("inventoryId", selectedInventoryId ? String(selectedInventoryId) : "");
    form.append("itemName", pickBulkField(item, "itemName", "itemname"));
    form.append("itemCode", pickBulkField(item, "itemCode", "itemcode"));
    form.append("serialNo", pickBulkField(item, "serialNo", "serialno"));
    form.append("serialNo2", pickBulkField(item, "serialNo2", "serialno2"));
    form.append("model", pickBulkField(item, "model"));
    form.append("QRCode", qr.qrcode);
    form.append("QRCode2", qr.qrcode2);
    form.append("qrcodeUrl", qr.qrcodeUrl);
    form.append("qrcode2Url", qr.qrcode2Url);
    form.append("pageno", pickBulkField(item, "pageno"));
    form.append("value", pickBulkField(item, "value"));
    form.append("purchaseDate", pickBulkField(item, "purchaseDate", "purchasedate", "purchase_date"));
    form.append("ginNo", getBulkGinNo(item));
    form.append("poNo", pickBulkField(item, "poNo", "pono"));
    form.append("supplier", pickBulkField(item, "supplier"));
    form.append("funding", normalizedFunding || fundingOtherValue);
    form.append("receivedfrom", pickBulkField(item, "receivedfrom", "receivedFrom"));
    form.append("warranty", normalizedWarranty || warrantyOtherValue);
    form.append("location", resolveBulkLocationValue(item));
    form.append("remarks", pickBulkField(item, "remarks"));

    if (typeof imageSource.existingItemImage === "string" && imageSource.existingItemImage.trim().startsWith("/uploads/")) {
      form.append("existingItemImage", imageSource.existingItemImage.trim());
    } else if (imageSource.itemImage instanceof File) {
      form.append("itemImage", imageSource.itemImage);
    }

    if (ginSource.existingGinfile) {
      form.append("existingGinfile", ginSource.existingGinfile);
    } else if (ginSource.ginfile instanceof File) {
      form.append("ginfile", ginSource.ginfile);
    }

    return form;
  };

  const handleBulkFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBulkFile(file);
      setBulkGinSystemCache({});
      parseBulkFile(file);
    }
  };

  const parseBulkFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const { rows, warnings } = parseBulkCsvText(event.target.result);

        if (rows.length === 0) {
          alert(warnings[0] || "No item rows were found in the CSV file.");
          return;
        }

        const shiftedRows = rows.filter((row) => detectBulkCsvColumnShift(row));
        if (shiftedRows.length > 0) {
          alert(
            [
              "The CSV columns appear misaligned. A purchase date is mapped to GIN No.",
              "Use the downloaded template as-is and do not remove the \"pageno\" column.",
              warnings.length ? `\n${warnings.join("\n")}` : "",
            ].join("\n")
          );
          return;
        }

        const itemsWithQr = rows.map((it, idx) => {
          const qr = buildBulkQrPayload(it, idx);
          return {
            ...it,
            itemName: pickBulkField(it, "itemName", "itemname"),
            itemCode: pickBulkField(it, "itemCode", "itemcode"),
            serialNo: pickBulkField(it, "serialNo", "serialno"),
            serialNo2: pickBulkField(it, "serialNo2", "serialno2"),
            ginNo: getBulkGinNo(it),
            ginfile: null,
            existingGinfile: "",
            itemImage: null,
            qrcode: qr.qrcode,
            qrcodeUrl: qr.qrcodeUrl,
            qrcode2: qr.qrcode2,
            qrcode2Url: qr.qrcode2Url,
            existingItemImage: "",
            bulkLocationType: "csv",
            bulkLocationUserId: "",
            bulkLocationPlace: "",
            bulkLocationOtherDetail: "",
          };
        });

        setBulkItems(itemsWithQr);
        setSelectedBulk({});
        setSelectAllBulk(false);
        loadBulkGinSystemCache(itemsWithQr);

        if (warnings.length > 0) {
          alert(`Parsed ${rows.length} items with warnings:\n${warnings.join("\n")}`);
        } else {
          alert(`Successfully parsed ${rows.length} items from CSV file`);
        }
      } catch (error) {
        alert("Error parsing CSV file. Please ensure it matches the downloaded template.");
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csvContent = buildBulkCsvTemplate();
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkSubmit = () => {
    if (isInchargeMode && !selectedInventoryId) {
      alert('Select the inventory you want to add these items to.');
      return;
    }

    if (bulkItems.length === 0) {
      alert('No items to upload. Please select a CSV file.');
      return;
    }

    for (let index = 0; index < bulkItems.length; index += 1) {
      const item = bulkItems[index];
      const locationType = String(item?.bulkLocationType || "csv");

      if (locationType === "person" && !String(item?.bulkLocationUserId || "").trim()) {
        alert(`Row ${index + 1}: Select a staff member.`);
        return;
      }

      if (locationType === "place" && !String(item?.bulkLocationPlace || "").trim()) {
        alert(`Row ${index + 1}: Select a place.`);
        return;
      }

      const needsOtherInput =
        (locationType === "person" && item?.bulkLocationUserId === LOCATION_OTHER_VALUE) ||
        (locationType === "place" && item?.bulkLocationPlace === LOCATION_OTHER_VALUE);

      if (needsOtherInput && !String(item?.bulkLocationOtherDetail || "").trim()) {
        alert(`Row ${index + 1}: Enter details for Other location.`);
        return;
      }

      if (!resolveBulkLocationValue(item)) {
        alert(`Row ${index + 1}: Select a valid location.`);
        return;
      }
    }

    (async () => {
      try {
        setBulkSubmitting(true);
        let createdCount = 0;
        const linkedImageByGroup = {};

        for (let index = 0; index < bulkItems.length; index += 1) {
          const item = bulkItems[index];
          const groupKey = getBulkImageGroupKey(item);
          const linkedImagePath = groupKey ? linkedImageByGroup[groupKey] || "" : "";
          const form = buildBulkItemFormData(item, bulkItems, index, linkedImagePath);
          const res = await fetch(`${API_BASE_URL}/api/items`, {
            method: "POST",
            body: form,
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok || !data.success) {
            const rowLabel = pickBulkField(item, "itemName", "itemname") || `Row ${index + 1}`;
            throw new Error(`Row ${index + 1} (${rowLabel}): ${data.error || data.message || "Upload failed"}`);
          }

          const createdImagePath = String(
            data?.item?.itemImage || data?.item?.item_image || ""
          ).trim();

          if (groupKey && createdImagePath.startsWith("/uploads/")) {
            linkedImageByGroup[groupKey] = createdImagePath;
          }

          createdCount += 1;
        }

        alert(`Successfully submitted ${createdCount} items`);
        setBulkFile(null);
        setBulkItems([]);
        setBulkGinSystemCache({});
        setSelectedBulk({});
        setSelectAllBulk(false);
      } catch (err) {
        console.error(err);
        alert(err.message || "Bulk upload failed. Ensure the API server is running.");
      } finally {
        setBulkSubmitting(false);
      }
    })();
  };

  const handleBulkPrint = async () => {
    if (!bulkItems || bulkItems.length === 0) {
      alert("No parsed items to print.");
      return;
    }

    const itemsToPrint = Object.keys(selectedBulk).length > 0
      ? bulkItems.filter((_, index) => selectedBulk[index])
      : bulkItems;

    const imageSize = labelLayout === "avery" ? 140 : 200;

    try {
      setBulkPrintLoading(true);
      const labelEntries = await buildBulkPrintLabelEntries(itemsToPrint, imageSize);

      if (labelEntries.length === 0) {
        alert(
          "No QR data available to print. Ensure each row has an item code (and serial numbers where needed) before printing labels."
        );
        return;
      }

      openQrLabelPrintWindow(labelEntries, labelLayout);
    } catch (error) {
      console.error(error);
      alert("Failed to generate QR labels for printing.");
    } finally {
      setBulkPrintLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isInchargeMode && !selectedInventoryId) {
      alert(
        isEditMode
          ? "Select the inventory this item belongs to."
          : "Select the inventory you want to add this item to."
      );
      return;
    }

    if (!itemData.itemName?.trim()) {
      alert("Item name is required.");
      return;
    }

    const resolvedLocation =
      locationAssignmentType === "person"
        ? selectedLocationUserId === LOCATION_OTHER_VALUE
          ? locationOtherDetail.trim()
          : (selectedLocationUser?.name || "")
        : selectedCommonPlace === LOCATION_OTHER_VALUE
          ? locationOtherDetail.trim()
          : selectedCommonPlace;

    if (locationAssignmentType === "person" && !selectedLocationUserId) {
      alert("Select a staff member for this item.");
      return;
    }

    if (locationAssignmentType === "place" && !selectedCommonPlace) {
      alert("Select a place for this item.");
      return;
    }

    if (showLocationOtherInput && !locationOtherDetail.trim()) {
      alert("Enter the person or place details for Other.");
      return;
    }

    if (!resolvedLocation) {
      alert("Select a valid person or place in Location Details.");
      return;
    }

    (async () => {
      const identifiersValid = await runIdentifierValidation(itemData);

      if (!identifiersValid) {
        return;
      }

      try {
        // prepare FormData for multipart upload (supports files)
        const form = new FormData();
        const normalizedFunding = itemData.funding === ITEM_FORM_OTHER_VALUE
          ? (itemData.fundingOther || "")
          : (itemData.funding || "");
        const normalizedWarranty = itemData.warranty === ITEM_FORM_OTHER_VALUE
          ? (itemData.warrantyOther || "")
          : (itemData.warranty || "");

        form.append('inventoryId', selectedInventoryId ? String(selectedInventoryId) : '');
        form.append('location', resolvedLocation);
        form.append('itemName', itemData.itemName || '');
        form.append('itemCode', itemData.itemCode || '');
        form.append('serialNo', itemData.serialNo || '');
        form.append('serialNo2', itemData.serialNo2 || '');
        form.append('model', itemData.model || '');
        form.append('QRCode', itemData.QRCode || '');
        form.append('QRCode2', itemData.QRCode2 || '');
        form.append('pageno', itemData.pageno || '');
        form.append('value', itemData.value || '');
        form.append('purchaseDate', itemData.purchaseDate || '');
        form.append('ginNo', itemData.ginNo || '');
        form.append('poNo', itemData.poNo || '');
        form.append('supplier', itemData.supplier || '');
        form.append('funding', !normalizedFunding && itemData.fundingOther ? itemData.fundingOther : normalizedFunding);
        form.append('receivedfrom', itemData.receivedfrom || '');
        form.append('warranty', !normalizedWarranty && itemData.warrantyOther ? itemData.warrantyOther : normalizedWarranty);
        form.append('remarks', itemData.remarks || '');

        if (itemData.itemImage) {
          form.append('itemImage', itemData.itemImage);
        } else if (existingItemImage) {
          form.append('existingItemImage', existingItemImage);
        }

        if (ginExistingFile) {
          form.append('existingGinfile', ginExistingFile);
        } else if (itemData.ginfile) {
          form.append('ginfile', itemData.ginfile);
        }

        const requestUrl = isEditMode
          ? `${API_BASE_URL}/api/items/${editItemId}`
          : `${API_BASE_URL}/api/items`;
        const requestMethod = isEditMode ? "PUT" : "POST";

        const res = await fetch(requestUrl, {
          method: requestMethod,
          body: form,
        });

        const data = await res.json();
        if (res.ok) {
          if (isEditMode) {
            alert("Item updated successfully");
            navigate(`/inventory/item/${editItemId}/${rolePath}`);
          } else {
            alert("Item added successfully");
            handleReset();
          }
        } else {
          if (data.conflicts) {
            applyIdentifierConflicts(data.conflicts);
          }
          alert("Save failed: " + (data.error || data.message || "unknown"));
        }
      } catch (err) {
        console.error(err);
        alert('Save failed (network). Ensure API server is running at http://localhost:4000');
      }
    })();
  };

  const handleReset = () => {
    if (isEditMode) {
      navigate(`/inventory/item/${editItemId}/${rolePath}`);
      return;
    }

    setIdentifierErrors(EMPTY_IDENTIFIER_ERRORS);
    setItemData({
      itemName: "",
      itemCode: "",
      serialNo: "",
      serialNo2: "",
      model: "",
      QRCode: "",
      QRCode2: "",
      pageno: "",
      itemImage: null,
      value: "",
      purchaseDate: "",
      ginNo: "",
      ginfile: null,
      poNo: "",
      supplier: "",
      funding: "",
      fundingOther: "",
      receivedfrom: "",
      warranty: "",
      warrantyOther: "",
      location: "",
      remarks: ""
    });
    setGinExistingFile("");
    setGinStatus("");
    setGinCheckLoading(false);
    setExistingItemImage("");
    setPendingEditLocation("");
    setLocationAssignmentType("person");
    setSelectedLocationUserId("");
    setSelectedCommonPlace("");
    setLocationOtherDetail("");
  };

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={isEditMode ? "Update Inventory Item" : "Add New Inventory Item"}
        subtitle={
          isEditMode
            ? "Update existing item details and save your changes."
            : "Register a new physical asset and generate QR labels from the same screen."
        }
        actions={
          !isEditMode ? (
          <div className="inline-flex rounded-xl border border-white/20 bg-white/10 p-1">
            <button
              type="button"
              onClick={() => {
                setUploadMode("single");
                setBulkFile(null);
                setBulkItems([]);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                uploadMode === "single"
                  ? "bg-white text-primary-800 shadow-sm"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              Single Item
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("bulk")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                uploadMode === "bulk"
                  ? "bg-white text-primary-800 shadow-sm"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              Bulk Upload
            </button>
          </div>
          ) : null
        }
      />

      <div className="p-6 space-y-6">
        {editLoading && (
          <div className="rounded border border-border-light bg-background-light px-4 py-3 text-sm text-text-dark">
            Loading item details…
          </div>
        )}
        {isInchargeMode && (
          <Card>
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text-dark">Target Inventory</h2>
                <p className="text-sm text-text-light">
                  Choose which assigned inventory should receive these items. This keeps inventories separate for the same account.
                </p>
              </div>
              {inventoryLoadError && (
                <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {inventoryLoadError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Assigned Inventory"
                  name="assignedInventory"
                  value={selectedInventoryId}
                  onChange={setSelectedInventoryId}
                  options={inventoryOptions}
                  placeholder="Select inventory"
                  required
                />
                <div className="rounded-md border border-border-light bg-background-light px-4 py-3 text-sm text-text-dark">
                  <p className="font-medium">Current Selection</p>
                  <p className="mt-1 text-text-light">
                    {selectedInventory ? `${selectedInventory.name} - ${selectedInventory.location || 'No location'}` : 'No inventory selected yet.'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm text-text-light">
          <span>Home</span>
          <span>/</span>
          <span>Inventory</span>
          <span>/</span>
          <span className="font-semibold text-primary-800">{isEditMode ? "Update Asset" : "Create Asset"}</span>
        </div>

        {/* Single Item Form */}
        {(uploadMode === "single" || isEditMode) && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-8" style={{ opacity: editLoading ? 0.6 : 1, pointerEvents: editLoading ? "none" : "auto" }}>
            {/* ==================== ITEM DETAILS SECTION ==================== */}
            <div className="space-y-4">
              <div className="pb-4 border-b-2 border-primary-500">
                <h2 className="text-xl font-bold text-text-dark">Item Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Item Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">
                    Item Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    value={itemData.itemName}
                    onChange={handleChange}
                    required
                    list="item-name-suggestions"
                    autoComplete="off"
                    placeholder="Enter item name"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-invalid={isItemNameMissing}
                  />
                  <datalist id="item-name-suggestions">
                    {itemNameSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                {/* Item Code */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Item Code</label>
                  <input
                    type="text"
                    name="itemCode"
                    value={itemData.itemCode}
                    onChange={handleChange}
                    onBlur={handleIdentifierBlur}
                    placeholder="Enter item code"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-invalid={Boolean(identifierErrors.itemCode)}
                  />
                  {identifierErrors.itemCode && (
                    <p className="rounded bg-yellow-100 px-4 py-3 text-sm text-text-dark border border-red-200 text-justify">
                      {identifierErrors.itemCode}
                    </p>
                  )}
                </div>

                {/* Serial Number */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Serial Number</label>
                  <input
                    type="text"
                    name="serialNo"
                    value={itemData.serialNo}
                    onChange={handleChange}
                    onBlur={handleIdentifierBlur}
                    placeholder="Enter serial number"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-invalid={Boolean(identifierErrors.serialNo)}
                  />
                  {identifierErrors.serialNo && (
                    <p className="rounded bg-yellow-100 px-4 py-3 text-sm text-text-dark border border-red-200 text-justify">
                      {identifierErrors.serialNo}
                    </p>
                  )}
                </div>

                {/* Serial Number 2 */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Serial Number 2 (For Computer Items)</label>
                  <input
                    type="text"
                    name="serialNo2"
                    value={itemData.serialNo2}
                    onChange={handleChange}
                    onBlur={handleIdentifierBlur}
                    placeholder="Enter serial number 2"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-invalid={Boolean(identifierErrors.serialNo2)}
                  />
                  {identifierErrors.serialNo2 && (
                    <p className="rounded bg-yellow-100 px-4 py-3 text-sm text-text-dark border border-red-200 text-justify">
                      {identifierErrors.serialNo2}
                    </p>
                  )}
                </div>

                {/* Brand/Model */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Brand/Model</label>
                  <input
                    type="text"
                    name="model"
                    value={itemData.model}
                    onChange={handleChange}
                    placeholder="Enter brand or model"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* QR Code */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">QR Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="QRCode"
                      value={itemData.QRCode}
                      onChange={handleChange}
                      placeholder="Enter QR code"
                      style={{ backgroundColor: '#F2F0F0' }}
                      className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => generateAndSetQRCode(1, false)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Auto-generate
                    </button>
                    <button
                      type="button"
                      onClick={() => generateAndSetQRCode(1, true)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Force generate
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintQr}
                      className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                    >
                      Print QR
                    </button>
                  </div>

                  {itemData.QRCode && (
                    <div className="mt-3 flex items-center gap-4">
                      <img
                        src={getExternalQrImageUrl(
                          buildItemScanUrl(itemData.QRCode, itemData.receivedfrom || ""),
                          120
                        )}
                        alt="QR preview"
                      />
                      <div className="text-sm">
                        <div className="font-semibold">{itemData.QRCode}</div>
                        <div className="text-text-light">Scan to view item</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inventory Page Number */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Inventory Page No</label>
                  <input
                    type="number"
                    name="pageno"
                    value={itemData.pageno}
                    onChange={handleChange}
                    placeholder="Enter Inventory page number"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* QR Code (Serial No 2) */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">QR Code (Serial No 2)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="QRCode2"
                      value={itemData.QRCode2}
                      onChange={handleChange}
                      placeholder="Enter QR code for serial no 2"
                      style={{ backgroundColor: '#F2F0F0' }}
                      className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => generateAndSetQRCode(2, false)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Auto-generate
                    </button>
                    <button
                      type="button"
                      onClick={() => generateAndSetQRCode(2, true)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Force generate
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintQr}
                      className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                    >
                      Print QR
                    </button>
                  </div>

                  {itemData.QRCode2 && (
                    <div className="mt-3 flex items-center gap-4">
                      <img
                        src={getExternalQrImageUrl(
                          buildItemScanUrl(itemData.QRCode2, itemData.receivedfrom || ""),
                          120
                        )}
                        alt="QR preview"
                      />
                      <div className="text-sm">
                        <div className="font-semibold">{itemData.QRCode2}</div>
                        <div className="text-text-light">Scan to view item</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Item Image */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Item Image</label>
                  <p className="text-xs text-text-light">JPG, JPEG, or PNG only</p>
                  <input
                    type="file"
                    name="itemImage"
                    onChange={handleImageChange}
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  
                  {itemData.itemImage && (
                    <p className="text-sm text-success mt-2">✓ {itemData.itemImage.name}</p>
                  )}
                  {existingItemImage && !itemData.itemImage && (
                    <div className="mt-2 space-y-2">
                      <img
                        src={resolveUploadUrl(existingItemImage)}
                        alt="Current item"
                        className="max-h-40 rounded border border-border object-contain bg-white"
                      />
                      <a
                        href={resolveUploadUrl(existingItemImage)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary-700 underline"
                      >
                        View current image
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ==================== PURCHASE DETAILS SECTION ==================== */}
            <div className="space-y-4">
              <div className="pb-4 border-b-2 border-primary-500">
                <h2 className="text-xl font-bold text-text-dark">Purchase Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Item Value */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Item Value (Rs.)</label>
                  <input
                    type="number"
                    name="value"
                    value={itemData.value}
                    onChange={handleChange}
                    placeholder="0.00"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Purchase Date */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Purchase Date</label>
                  <input
                    type="date"
                    name="purchaseDate"
                    value={itemData.purchaseDate}
                    onChange={handleChange}
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Purchase Order No */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Purchase Order No</label>
                  <input
                    type="number"
                    name="poNo"
                    value={itemData.poNo}
                    onChange={handleChange}
                    placeholder="Enter PO number"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Supplier */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Supplier</label>
                  <input
                    type="text"
                    name="supplier"
                    value={itemData.supplier}
                    onChange={handleChange}
                    placeholder="Enter supplier name"
                    style={{ backgroundColor: "#F2F0F0" }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* GIN No */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">GIN No</label>
                  <input
                    type="text"
                    name="ginNo"
                    value={itemData.ginNo}
                    onChange={handleChange}
                    placeholder="Enter GIN number"
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* GIN PDF */}
                <div
                  className={`space-y-2 rounded-lg border p-3 ${
                    ginExistingFile ? "border-green-300 bg-green-50" : "border-transparent"
                  }`}
                >
                  <label className="block text-sm font-semibold text-text-dark">GIN PDF</label>
                  <p className="text-xs text-text-light">
                    {ginExistingFile ? "Reuse stored PDF (upload disabled)" : "PDF only"}
                  </p>
                  <input
                    type="file"
                    name="ginfile"
                    onChange={handleGinFileChange}
                    accept=".pdf,application/pdf"
                    disabled={!!ginExistingFile || ginCheckLoading}
                    style={{ backgroundColor: ginExistingFile ? "#e8f5e9" : "#F2F0F0" }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  {ginCheckLoading && (
                    <p className="text-sm text-text-light mt-2">Checking for existing GIN PDF…</p>
                  )}
                  {!ginCheckLoading && ginStatus && (
                    <p
                      className={`text-sm mt-2 ${
                        ginExistingFile ? "text-green-800 font-medium" : "text-primary-700"
                      }`}
                      role="status"
                    >
                      {ginStatus}
                    </p>
                  )}
                  {ginExistingFile && (
                    <p className="text-sm mt-2">
                      <a
                        href={resolveUploadUrl(ginExistingFile)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-700 underline font-medium"
                      >
                        View stored GIN PDF
                      </a>
                    </p>
                  )}
                  {itemData.ginfile && !ginExistingFile && (
                    <p className="text-sm text-success mt-2">✓ {itemData.ginfile.name}</p>
                  )}
                </div>

                {/* Funding Source */}
                <div className="space-y-2">
                  <Select
                    label="Funding Source"
                    name="funding"
                    value={itemData.funding}
                    onChange={handleSelectFieldChange("funding")}
                    options={ITEM_FUNDING_OPTIONS}
                    placeholder="Select funding source"
                  />
                  {itemData.funding === ITEM_FORM_OTHER_VALUE && (
                    <input
                      type="text"
                      name="fundingOther"
                      value={itemData.fundingOther}
                      onChange={handleChange}
                      required
                      placeholder="Specify funding source"
                      style={{ backgroundColor: "#F2F0F0" }}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>

                {/* Received/Transferred From */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Received/Transferred From</label>
                  <input
                    type="text"
                    name="receivedfrom"
                    value={itemData.receivedfrom}
                    onChange={handleChange}
                    placeholder="Enter source"
                    style={{ backgroundColor: "#F2F0F0" }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Warranty Period */}
                <div className="space-y-2">
                  <Select
                    label="Warranty Period"
                    name="warranty"
                    value={itemData.warranty}
                    onChange={handleSelectFieldChange("warranty")}
                    options={ITEM_WARRANTY_OPTIONS}
                    placeholder="Select warranty period"
                  />
                  {itemData.warranty === ITEM_FORM_OTHER_VALUE && (
                    <input
                      type="text"
                      name="warrantyOther"
                      value={itemData.warrantyOther}
                      onChange={handleChange}
                      required
                      placeholder="Specify warranty period"
                      style={{ backgroundColor: "#F2F0F0" }}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ==================== LOCATION Details SECTION ==================== */}
            <div className="space-y-4">
              <div className="pb-4 border-b-2 border-primary-500">
                <h2 className="text-xl font-bold text-text-dark">Location Details</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-text-dark">Assign To <span className="text-danger">*</span></label>
                  <select
                    value={locationAssignmentType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setLocationAssignmentType(nextType);
                      setLocationOtherDetail("");
                      if (nextType === "person") {
                        setSelectedCommonPlace("");
                      } else {
                        setSelectedLocationUserId("");
                      }
                    }}
                    style={{ backgroundColor: '#F2F0F0' }}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="person">Staff Member</option>
                    <option value="place">Place</option>
                  </select>
                </div>

                <div className="space-y-2">
                  {locationAssignmentType === "person" ? (
                    <Select
                      label="Staff Member"
                      name="issuedToUser"
                      value={selectedLocationUserId}
                      onChange={(value) => {
                        setSelectedLocationUserId(value);
                        if (value !== LOCATION_OTHER_VALUE) {
                          setLocationOtherDetail("");
                        }
                      }}
                      options={userLocationOptions}
                      placeholder="Select a staff member"
                      required
                    />
                  ) : (
                    <Select
                      label="Location"
                      name="commonPlace"
                      value={selectedCommonPlace}
                      onChange={(value) => {
                        setSelectedCommonPlace(value);
                        if (value !== LOCATION_OTHER_VALUE) {
                          setLocationOtherDetail("");
                        }
                      }}
                      options={commonPlaceOptions}
                      placeholder="Select a place"
                      required
                    />
                  )}
                </div>

                {showLocationOtherInput && (
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm font-semibold text-text-dark">
                      Other location details <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="locationOtherDetail"
                      value={locationOtherDetail}
                      onChange={(e) => setLocationOtherDetail(e.target.value)}
                      placeholder="Enter person or place outside the faculty"
                      style={{ backgroundColor: "#F2F0F0" }}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                {usersLoadError && locationAssignmentType === "person" && (
                  <div className="md:col-span-2 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {usersLoadError}
                  </div>
                )}
              </div>
            </div>

            {/* ==================== ADDITIONAL REMARKS SECTION ==================== */}
            <div className="space-y-4">
              <div className="pb-4 border-b-2 border-primary-500">
                <h2 className="text-xl font-bold text-text-dark">Additional Remarks</h2>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">Remarks</label>
                <textarea
                  name="remarks"
                  value={itemData.remarks}
                  onChange={handleChange}
                  placeholder="Enter any additional remarks"
                  rows="4"
                  style={{ backgroundColor: '#F2F0F0' }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t border-border">
              <Button
                type="button"
                onClick={handleReset}
                variant="secondary"
              >
                {isEditMode ? "Cancel" : "Reset"}
              </Button>
              <Button
                type="button"
                onClick={() => (isEditMode ? navigate(`/inventory/item/${editItemId}/${rolePath}`) : window.history.back())}
                variant="tertiary"
              >
                {isEditMode ? "Back to details" : "Cancel"}
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon="save"
                disabled={isSaveDisabled}
              >
                {isEditMode ? "Save Changes" : "Save Item"}
              </Button>
            </div>
          </form>
        </Card>
        )}

        {/* Bulk Upload Form */}
        {uploadMode === "bulk" && (
        <Card>
          <div className="space-y-6">
            {/* Section Header */}
            <div className="pb-4 border-b-2 border-primary-500">
              <h2 className="text-xl font-bold text-text-dark">Bulk Item Upload</h2>
              <p className="text-text-light text-sm mt-2">
                Upload multiple items at once using a CSV file. QR codes are generated automatically from each row&apos;s item code and serial number(s) and saved when you upload.
              </p>
            </div>

            {/* Download Template */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm text-text-dark">
                <strong>Need a template?</strong> Download the CSV template to get started with the correct format.
                Keep every column header, including <strong>pageno</strong>, even if you leave the value blank.
              </p>
           
              <button
                type="button"
                onClick={downloadTemplate}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-semibold"
              >
                Download CSV Template
              </button>
            </div>

            {/* File Upload Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-text-dark">
                  Select CSV File <span className="text-danger">*</span>
                </label>
                <input
                  type="file"
                  onChange={handleBulkFileChange}
                  accept=".csv"
                  style={{ backgroundColor: '#F2F0F0' }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {bulkFile && (
                  <p className="text-sm text-success mt-2">✓ {bulkFile.name}</p>
                )}
              </div>
            </div>

            {/* Bulk controls: layout + select all */}
            {bulkItems.length > 0 && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold">Label Layout:</label>
                  <select value={labelLayout} onChange={e => setLabelLayout(e.target.value)} className="px-3 py-2 border rounded-lg bg-white">
                    <option value="grid">Grid (large)</option>
                    <option value="avery">Avery (small labels)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm">Select All</label>
                  <input type="checkbox" checked={selectAllBulk} onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectAllBulk(checked);
                    if (checked) {
                      const obj = {};
                      bulkItems.forEach((it, i) => { obj[i] = true; });
                      setSelectedBulk(obj);
                    } else {
                      setSelectedBulk({});
                    }
                  }} />
                </div>
              </div>
            )}

            {/* Preview Section */}
            {bulkItems.length > 0 && (
              <div className="space-y-3">
                <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-success">
                    ✓ Ready to upload: {bulkItems.length} items
                  </p>
                  <p className="text-xs text-text-light mt-2">
                    CSV cannot include PDF or image files. Use the buttons in each row to attach GIN PDF and item image.
                    Rows sharing the same GIN No reuse one GIN PDF upload; rows with the same GIN, item code, and name reuse one item image.
                  </p>
                </div>

                <div className="overflow-x-auto max-h-[28rem] overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-semibold">
                          <input
                            type="checkbox"
                            checked={selectAllBulk}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectAllBulk(checked);
                              if (checked) {
                                const obj = {};
                                bulkItems.forEach((_, i) => { obj[i] = true; });
                                setSelectedBulk(obj);
                              } else {
                                setSelectedBulk({});
                              }
                            }}
                          />
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">Item Name</th>
                        <th className="px-3 py-2 text-left font-semibold">Item Code</th>
                        <th className="px-3 py-2 text-left font-semibold">Serial No</th>
                        <th className="px-3 py-2 text-left font-semibold">GIN No</th>
                        <th className="px-3 py-2 text-left font-semibold">GIN PDF</th>
                        <th className="px-3 py-2 text-left font-semibold">Item Image</th>
                        <th className="px-3 py-2 text-left font-semibold">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkItems.map((item, index) => {
                        const ginDisabled = isBulkGinUploadDisabled(index);
                        const imageDisabled = isBulkImageUploadDisabled(index);
                        const ginStatus = getBulkGinStatus(index);
                        const imageStatus = getBulkImageStatus(index);
                        const ginKey = getBulkGinKey(item);
                        const systemGinPath = ginKey ? bulkGinSystemCache[ginKey] : "";
                        const imageSourceIndex = getBulkImageSourceIndex(getBulkImageGroupKey(item), bulkItems);

                        return (
                          <tr key={index} className="border-b hover:bg-gray-50 align-top">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!!selectedBulk[index]}
                                onChange={(e) => {
                                  const obj = { ...selectedBulk };
                                  if (e.target.checked) {
                                    obj[index] = true;
                                  } else {
                                    delete obj[index];
                                  }
                                  setSelectedBulk(obj);
                                  setSelectAllBulk(Object.keys(obj).length === bulkItems.length);
                                }}
                              />
                            </td>
                            <td className="px-3 py-2">{pickBulkField(item, "itemName", "itemname") || "-"}</td>
                            <td className="px-3 py-2">{pickBulkField(item, "itemCode", "itemcode") || "-"}</td>
                            <td className="px-3 py-2">{pickBulkField(item, "serialNo", "serialno") || "-"}</td>
                            <td className="px-3 py-2">{getBulkGinNo(item) || "-"}</td>
                            <td className="px-3 py-2 min-w-[180px]">
                              <div className="space-y-1">
                                {ginDisabled ? (
                                  <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-text-light">
                                    {systemGinPath ? "Stored PDF" : "Not required"}
                                  </span>
                                ) : (
                                  <label className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-primary-500 text-white cursor-pointer hover:bg-primary-600">
                                    Upload PDF
                                    <input
                                      type="file"
                                      accept=".pdf,application/pdf"
                                      className="hidden"
                                      onChange={(e) => handleBulkGinFileChange(index, e)}
                                    />
                                  </label>
                                )}
                                <p className={`text-xs ${ginDisabled && systemGinPath ? "text-green-700" : "text-text-light"}`}>
                                  {ginStatus}
                                </p>
                                {systemGinPath && (
                                  <a
                                    href={resolveUploadUrl(systemGinPath)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary-600 underline"
                                  >
                                    View stored PDF
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 min-w-[180px]">
                              <div className="space-y-1">
                                {imageDisabled ? (
                                  <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-text-light">
                                    {imageSourceIndex >= 0 ? "Shared image" : "Not required"}
                                  </span>
                                ) : (
                                  <label className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-primary-500 text-white cursor-pointer hover:bg-primary-600">
                                    Upload image
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                      className="hidden"
                                      onChange={(e) => handleBulkImageFileChange(index, e)}
                                    />
                                  </label>
                                )}
                                <p className="text-xs text-text-light">{imageStatus}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2 min-w-[280px]">
                              <div className="space-y-2">
                                <select
                                  value={item.bulkLocationType || "csv"}
                                  onChange={(e) => {
                                    const nextType = e.target.value;
                                    updateBulkItemAt(index, {
                                      bulkLocationType: nextType,
                                      bulkLocationOtherDetail: "",
                                      bulkLocationUserId: nextType === "person" ? (item.bulkLocationUserId || "") : "",
                                      bulkLocationPlace: nextType === "place" ? (item.bulkLocationPlace || "") : "",
                                    });
                                  }}
                                  style={{ backgroundColor: "#F2F0F0" }}
                                  className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                  <option value="person">Staff Member</option>
                                  <option value="place">Place</option>
                                </select>

                                {(item.bulkLocationType || "csv") === "person" && (
                                  <select
                                    value={item.bulkLocationUserId || ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      updateBulkItemAt(index, {
                                        bulkLocationUserId: value,
                                        bulkLocationOtherDetail:
                                          value === LOCATION_OTHER_VALUE
                                            ? item.bulkLocationOtherDetail || ""
                                            : "",
                                      });
                                    }}
                                    style={{ backgroundColor: "#F2F0F0" }}
                                    className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  >
                                    <option value="">Select staff member</option>
                                    {userLocationOptions.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                )}

                                {(item.bulkLocationType || "csv") === "place" && (
                                  <select
                                    value={item.bulkLocationPlace || ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      updateBulkItemAt(index, {
                                        bulkLocationPlace: value,
                                        bulkLocationOtherDetail:
                                          value === LOCATION_OTHER_VALUE
                                            ? item.bulkLocationOtherDetail || ""
                                            : "",
                                      });
                                    }}
                                    style={{ backgroundColor: "#F2F0F0" }}
                                    className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  >
                                    <option value="">Select place</option>
                                    {commonPlaceOptions.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                )}

                                {(((item.bulkLocationType || "csv") === "person" && item.bulkLocationUserId === LOCATION_OTHER_VALUE) ||
                                  ((item.bulkLocationType || "csv") === "place" && item.bulkLocationPlace === LOCATION_OTHER_VALUE)) && (
                                  <input
                                    type="text"
                                    value={item.bulkLocationOtherDetail || ""}
                                    onChange={(e) => updateBulkItemAt(index, { bulkLocationOtherDetail: e.target.value })}
                                    placeholder="Enter other location"
                                    style={{ backgroundColor: "#F2F0F0" }}
                                    className="w-full px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                )}

                                <p className="text-xs text-text-light">
                                  Final: {resolveBulkLocationValue(item) || "Not selected"}
                                </p>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t border-border">
              <Button
                type="button"
                onClick={() => {
                  setBulkFile(null);
                  setBulkItems([]);
                  setBulkGinSystemCache({});
                }}
                variant="secondary"
              >
                Clear
              </Button>
              <Button
                type="button"
                onClick={() => setUploadMode("single")}
                variant="tertiary"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleBulkPrint}
                variant="secondary"
                disabled={bulkItems.length === 0 || bulkPrintLoading}
              >
                {bulkPrintLoading ? "Generating QR labels..." : "Print QR Labels"}
              </Button>
              <Button
                type="button"
                onClick={handleBulkSubmit}
                variant="primary"
                disabled={bulkItems.length === 0 || bulkSubmitting}
              >
                {bulkSubmitting ? "Uploading..." : `Upload ${bulkItems.length} Items`}
              </Button>
            </div>
          </div>
        </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default AddNewItem;
