/** Shared dropdown values for Add Item form and CSV bulk template. */

export const ITEM_FORM_OTHER_VALUE = "other";

export const ITEM_FUNDING_OPTIONS = [
  { value: "Capital Fund", label: "Capital Fund" },
  { value: "University Development Fund", label: "University Development Fund" },
  { value: "Faculty Development Fund", label: "Faculty Development Fund" },
  { value: "Department Development Fund", label: "Department Development Fund" },
  { value: ITEM_FORM_OTHER_VALUE, label: "Other (please specify)" },
];

export const ITEM_WARRANTY_OPTIONS = [
  { value: "6 Months", label: "6 Months" },
  { value: "1 Year", label: "1 Year" },
  { value: "2 Years", label: "2 Years" },
  { value: "3 Years", label: "3 Years" },
  { value: "4 Years", label: "4 Years" },
  { value: "5 Years", label: "5 Years" },
  { value: ITEM_FORM_OTHER_VALUE, label: "Other (please specify)" },
];

export function getKnownOptionValues(options = []) {
  return new Set(
    options
      .filter((option) => option.value !== ITEM_FORM_OTHER_VALUE)
      .map((option) => option.value)
  );
}

export const ITEM_FUNDING_KNOWN_VALUES = getKnownOptionValues(ITEM_FUNDING_OPTIONS);
export const ITEM_WARRANTY_KNOWN_VALUES = getKnownOptionValues(ITEM_WARRANTY_OPTIONS);

export const LEGACY_FUNDING_VALUES = {
  capital: "Capital Fund",
  unidevfund: "University Development Fund",
  facdevfund: "Faculty Development Fund",
  deptdevfund: "Department Development Fund",
};

export const LEGACY_WARRANTY_VALUES = {
  "1year": "1 Year",
  "2years": "2 Years",
  "3years": "3 Years",
  "5years": "5 Years",
};

export function resolveItemOptionField(value, knownValues, legacyMap = {}) {
  const normalized = String(value || "").trim();
  const mapped = legacyMap[normalized] || normalized;

  if (!mapped) {
    return { selected: "", other: "" };
  }

  if (knownValues.has(mapped)) {
    return { selected: mapped, other: "" };
  }

  if (mapped === ITEM_FORM_OTHER_VALUE) {
    return { selected: ITEM_FORM_OTHER_VALUE, other: "" };
  }

  return { selected: ITEM_FORM_OTHER_VALUE, other: mapped };
}
