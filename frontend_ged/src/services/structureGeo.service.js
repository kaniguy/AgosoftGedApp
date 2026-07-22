import { getApiUrl, getHeaders, apiFetch } from "./api";

// LISTE
export const getStructuresGeographiques = async () => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/structures-geographiques/structures-geographiques/`,
    {
      headers: getHeaders(),
    }
  );

  return res.json();
};

// CREATE
export const createStructureGeographique = async (data) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/structures-geographiques/structures-geographiques/`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );

  return res.json();
};

// UPDATE
export const updateStructureGeographique = async (id, data) => {
  const res = await apiFetch(
    `${getApiUrl()}/api/parametrage/structures-geographiques/structures-geographiques/${id}/`,
    {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }
  );

  return res.json();
};

// DELETE
export const deleteStructureGeographique = async (id) => {
  await apiFetch(
    `${getApiUrl()}/api/parametrage/structures-geographiques/structures-geographiques/${id}/`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
  );

  return { success: true };
};