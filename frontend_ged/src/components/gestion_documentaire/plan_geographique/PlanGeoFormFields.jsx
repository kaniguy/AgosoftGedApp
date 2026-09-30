"use client";

function Field({ label, required, error, children, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default function PlanGeoFormFields({ formData, formErrors, onChange, focusRing = "blue" }) {
  const ringClass =
    focusRing === "green"
      ? "focus:ring-green-500"
      : "focus:ring-blue-500";

  const inputClass = (name) =>
    `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${ringClass} ${
      formErrors[name] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <>
      <Field label="Code" error={formErrors.code} hint="Code unique dans le même niveau et la même branche">
        <input
          type="text"
          name="code"
          value={formData.code}
          onChange={onChange}
          className={`${inputClass("code")} uppercase font-semibold bg-gray-50`}
          placeholder="Ex: DG, DT, DP..."
          autoFocus
        />
      </Field>

      <Field label="Libellé" required error={formErrors.libelle}>
        <input
          type="text"
          name="libelle"
          value={formData.libelle}
          onChange={onChange}
          className={inputClass("libelle")}
          placeholder="Ex: Direction Générale, Direction Technique..."
        />
      </Field>

      <Field label="Description" error={formErrors.description}>
        <textarea
          name="description"
          value={formData.description}
          onChange={onChange}
          rows={3}
          className={inputClass("description")}
          placeholder="Description optionnelle..."
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Latitude" error={formErrors.latitude} hint="Ex: 5.359952">
          <input
            type="text"
            name="latitude"
            value={formData.latitude}
            onChange={onChange}
            className={inputClass("latitude")}
            placeholder="+"
          />
        </Field>

        <Field label="Longitude" error={formErrors.longitude} hint="Ex: -4.008256">
          <input
            type="text"
            name="longitude"
            value={formData.longitude}
            onChange={onChange}
            className={inputClass("longitude")}
            placeholder="-"
          />
        </Field>
      </div>
    </>
  );
}

export const EMPTY_PLAN_FORM = {
  libelle: "",
  code: "",
  description: "",
  latitude: "",
  longitude: "",
};

export function nodeToFormData(node) {
  return {
    libelle: node?.libelle || "",
    code: node?.code || "",
    description: node?.description || "",
    latitude: node?.latitude != null ? String(node.latitude) : "",
    longitude: node?.longitude != null ? String(node.longitude) : "",
  };
}

export function buildPayload(formData) {
  return {
    libelle: formData.libelle.trim(),
    code: formData.code.trim() || null,
    description: formData.description.trim(),
    ...(formData.latitude.trim() ? { latitude: formData.latitude.trim() } : {}),
    ...(formData.longitude.trim() ? { longitude: formData.longitude.trim() } : {}),
  };
}

export function validatePlanForm(formData) {
  const errors = {};
  if (!formData.libelle.trim()) {
    errors.libelle = "Le libellé est requis";
  }
  return errors;
}
