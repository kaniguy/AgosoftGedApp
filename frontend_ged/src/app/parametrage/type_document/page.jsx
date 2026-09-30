// app/parametrage/type_document/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { getTypeDocuments, createTypeDocument, updateTypeDocument, deleteTypeDocument } 
from "../../../services/typeDocument.service";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";
import { parseLibellesFromPlus, uniqueCodeFromLibelle } from "../../../utils/parseLibelles";

export default function TypeDocumentPage() {
  const router = useRouter();
  const { canAdd, canChange, canDelete } = useCrudPermissions(MODELS.TYPE_DOCUMENT);
  const showRowActions = canChange || canDelete;
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showAjouterModal, setShowAjouterModal] = useState(false);
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [showSupprimerModal, setShowSupprimerModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ code: "", libelle: "" });
  const [formErrors, setFormErrors] = useState({});
  const [notification, setNotification] = useState(null);
  const itemsPerPage = 10;

  useEffect(() => {
    load();
  }, [currentPage, searchQuery]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      
      const result = await getTypeDocuments();
      
      let filteredData = Array.isArray(result) ? result : [];
      
      if (searchQuery) {
        filteredData = filteredData.filter(item => 
          item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.libelle?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      setTotalCount(filteredData.length);
      setTotalPages(Math.ceil(filteredData.length / itemsPerPage));
      
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      setData(filteredData.slice(start, end));
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      setError(error.message);
      showNotification(error.message || "Erreur lors du chargement des données", "error");
    } finally {
      setLoading(false);
    }
  }

  const checkCodeExists = (code, excludeId = null) => {
    return data.some(item => 
      item.code?.toUpperCase() === code?.toUpperCase() && 
      item.id !== excludeId
    );
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  const openAjouterModal = () => {
    setFormData({ code: "", libelle: "" });
    setFormErrors({});
    setShowAjouterModal(true);
  };

  const openModifierModal = (item) => {
    setSelectedItem(item);
    setFormData({ code: item.code, libelle: item.libelle });
    setFormErrors({});
    setShowModifierModal(true);
  };

  const openSupprimerModal = (item) => {
    setSelectedItem(item);
    setShowSupprimerModal(true);
  };

  const handleAjouter = async (e) => {
    e.preventDefault();

    const libelles = parseLibellesFromPlus(formData.libelle);
    const isBulk = libelles.length > 1;
    const errors = {};

    if (libelles.length === 0) {
      errors.libelle = "Le libellé est requis";
    }

    if (!isBulk) {
      if (!formData.code.trim()) {
        errors.code = "Le code est requis";
      } else if (checkCodeExists(formData.code)) {
        errors.code = "Ce code existe déjà. Veuillez saisir un code unique";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      if (!isBulk) {
        await createTypeDocument(formData);
        setShowAjouterModal(false);
        showNotification("Type de document ajouté avec succès", "success");
      } else {
        const all = await getTypeDocuments();
        const usedCodes = new Set(
          (Array.isArray(all) ? all : []).map((item) => item.code?.toUpperCase()).filter(Boolean)
        );
        let created = 0;
        const failures = [];

        for (const libelle of libelles) {
          try {
            const code = uniqueCodeFromLibelle(libelle, (candidate) =>
              usedCodes.has(candidate.toUpperCase())
            );
            await createTypeDocument({ code, libelle });
            usedCodes.add(code.toUpperCase());
            created += 1;
          } catch (err) {
            failures.push(`${libelle} : ${err.message || "erreur"}`);
          }
        }

        if (created === 0) {
          throw new Error(failures[0] || "Aucun type de document n'a pu être créé");
        }

        setShowAjouterModal(false);
        showNotification(
          failures.length
            ? `${created} type(s) créé(s). Échec : ${failures.join(" ; ")}`
            : `${created} types de document créés avec succès`,
          failures.length ? "error" : "success"
        );
      }
      await load();
    } catch (error) {
      console.error("Erreur ajout:", error);
      if (error.message.includes("duplicate") || error.message.includes("existe déjà")) {
        setFormErrors({ code: "Ce code existe déjà dans la base de données" });
      } else {
        showNotification(error.message || "Erreur lors de l'ajout", "error");
      }
    }
  };

  const handleModifier = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!formData.code.trim()) {
      errors.code = "Le code est requis";
    } else if (checkCodeExists(formData.code, selectedItem.id)) {
      errors.code = "Ce code existe déjà. Veuillez saisir un code unique";
    }
    
    if (!formData.libelle.trim()) {
      errors.libelle = "Le libellé est requis";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      await updateTypeDocument(selectedItem.id, formData);
      setShowModifierModal(false);
      showNotification("Type de document modifié avec succès", "success");
      await load();
    } catch (error) {
      console.error('Erreur modification:', error);
      if (error.message.includes("duplicate") || error.message.includes("existe déjà")) {
        setFormErrors({ code: "Ce code existe déjà dans la base de données" });
      } else {
        showNotification(error.message || "Erreur lors de la modification", "error");
      }
    }
  };

  const handleSupprimer = async () => {
    try {
      await deleteTypeDocument(selectedItem.id);
      setShowSupprimerModal(false);
      showNotification("Type de document supprimé avec succès", "success");
      await load();
    } catch (error) {
      console.error('Erreur suppression:', error);
      showNotification(error.message || "Erreur lors de la suppression", "error");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    
    if (name === 'code') {
      newValue = value.toUpperCase();
    }
    
    setFormData(prev => ({ ...prev, [name]: newValue }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <div className="min-h-app-screen bg-transparent">
      {/* Notification Container */}
      {notification && (
        <div className="fixed top-20 right-5 z-[99999] animate-slide-in-right">
          <div className={`
            min-w-[300px] max-w-[500px] p-4 rounded-lg shadow-lg flex items-center gap-3
            ${notification.type === 'success' ? 'bg-green-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}
            text-white
          `}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {notification.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="p-8">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Types de documents</h1>
            <nav className="mt-2">
              <ol className="flex items-center gap-2 text-sm text-gray-500">
                <li>
                  <button type="button" onClick={() => router.push("/")} className="hover:text-blue-600 transition">
                    Accueil
                  </button>
                </li>
                <li><span>/</span></li>
                <li className="text-gray-400">Paramétrage</li>
                <li><span>/</span></li>
                <li className="text-gray-700 font-medium">Types de documents</li>
              </ol>
            </nav>
          </div>
          {canAdd && (
          <button
            onClick={openAjouterModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
          )}
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            {/* Barre de recherche et info pagination */}
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-lg font-semibold text-gray-800">
                Liste des types de documents
                {totalCount > 0 && ` / Total : ${totalCount}`}
              </h5>
              <div className="flex gap-4 items-center">
                <div className="text-sm text-gray-500">
                  Affichage {startIndex} à {endIndex} sur {totalCount}
                </div>
                <div className="w-80 flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Rechercher..."
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      title="Effacer la recherche"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <strong>Erreur:</strong> {error}
                <button onClick={load} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition">
                  Réessayer
                </button>
              </div>
            )}

            {/* Tableau avec scroll et entête fixe - CORRIGÉ */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-500">Chargement...</p>
              </div>
            ) : data.length === 0 && !error ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">Aucun type de document trouvé.</p>
                {canAdd && (
                <button
                  onClick={openAjouterModal}
                  className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Ajouter un type de document
                </button>
                )}
              </div>
            ) : (
              <>
                {/* Conteneur avec scroll vertical */}
                <div className="overflow-auto max-h-[500px] border border-gray-300 rounded-lg relative">
                  <table className="w-full border-collapse relative">
                    {/* En-tête fixe avec fond opaque */}
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-gray-800">
                        <th className="border border-gray-700 px-4 py-3 text-left text-white w-[80px] sticky top-0 bg-gray-800 shadow-sm">N°</th>
                        <th className="border border-gray-700 px-4 py-3 text-left text-white w-[150px] sticky top-0 bg-gray-800 shadow-sm">Code</th>
                        <th className="border border-gray-700 px-4 py-3 text-left text-white sticky top-0 bg-gray-800 shadow-sm">Libellé</th>
                        {showRowActions && (
                        <th className="border border-gray-700 px-4 py-3 text-center text-white w-[200px] sticky top-0 bg-gray-800 shadow-sm">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {data.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="border border-gray-300 px-4 py-3 text-gray-700">{startIndex + index}</td>
                          <td className="border border-gray-300 px-4 py-3 font-bold text-gray-800">{item.code}</td>
                          <td className="border border-gray-300 px-4 py-3 text-gray-700">{item.libelle}</td>
                          {showRowActions && (
                          <td className="border border-gray-300 px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              {canChange && (
                              <button
                                onClick={() => openModifierModal(item)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Modifier
                              </button>
                              )}
                              {canDelete && (
                              <button
                                onClick={() => openSupprimerModal(item)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Supprimer
                              </button>
                              )}
                            </div>
                          </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <nav className="mt-4">
                    <ul className="flex justify-center gap-2">
                      <li>
                        <button
                          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                          disabled={currentPage === 1}
                          className={`px-3 py-1 border rounded-lg transition ${
                            currentPage === 1
                              ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Précédent
                        </button>
                      </li>
                      
                      {getPageNumbers().map(num => (
                        <li key={num}>
                          <button
                            onClick={() => setCurrentPage(num)}
                            className={`px-3 py-1 border rounded-lg transition ${
                              currentPage === num
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {num}
                          </button>
                        </li>
                      ))}
                      
                      <li>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className={`px-3 py-1 border rounded-lg transition ${
                            currentPage === totalPages
                              ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Suivant
                        </button>
                      </li>
                    </ul>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modales - Ajouter, Modifier, Supprimer (inchangées) */}
        {/* // app/parametrage/type_document/page.jsx (modales corrigées) */}

      {/* Modal Ajouter */}
      {showAjouterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-t-lg flex justify-between items-center">
              <h5 className="text-lg font-semibold">Nouveau type de document</h5>
              <button 
                onClick={() => setShowAjouterModal(false)} 
                className="text-white hover:text-red-500 transition-colors duration-200 text-2xl font-bold leading-none"
                style={{ lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAjouter}>
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-bold bg-gray-100 ${
                      formErrors.code ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ex: DOC, FACT, BON"
                    maxLength={10}
                    required
                  />
                  {formErrors.code && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formErrors.code}
                    </p>
                  )}
                  <small className="text-xs text-gray-500">Code unique du type de document (3-10 caractères)</small>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Libellé <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="libelle"
                    value={formData.libelle}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.libelle ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ex: Document, Facture + Devis + Contrat"
                    required
                  />
                  {formErrors.libelle && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formErrors.libelle}
                    </p>
                  )}
                  {/* <small className="text-xs text-gray-500">
                    Plusieurs libellés séparés par « + » créent plusieurs lignes. Le code est généré automatiquement.
                  </small> */}
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                <button type="button" onClick={() => setShowAjouterModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modifier */}
      {showModifierModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="bg-green-600 text-white px-6 py-3 rounded-t-lg flex justify-between items-center">
              <h5 className="text-lg font-semibold">Modifier type de document</h5>
              <button 
                onClick={() => setShowModifierModal(false)} 
                className="text-white hover:text-red-500 transition-colors duration-200 text-2xl font-bold leading-none"
                style={{ lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleModifier}>
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 uppercase font-bold bg-gray-100 ${
                      formErrors.code ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ex: DOC, FACT, BON"
                    maxLength={10}
                    required
                  />
                  {formErrors.code && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formErrors.code}
                    </p>
                  )}
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Libellé <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="libelle"
                    value={formData.libelle}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      formErrors.libelle ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ex: Document, Facture, Bon de commande"
                    required
                  />
                  {formErrors.libelle && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formErrors.libelle}
                    </p>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
                <button type="button" onClick={() => setShowModifierModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Supprimer */}
      {showSupprimerModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="bg-red-600 text-white px-6 py-3 rounded-t-lg flex justify-between items-center">
              <h5 className="text-lg font-semibold">Supprimer {selectedItem.code} ?</h5>
              <button 
                onClick={() => setShowSupprimerModal(false)} 
                className="text-white hover:text-red-200 transition-colors duration-200 text-2xl font-bold leading-none"
                style={{ lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <p>Êtes-vous sûr de vouloir supprimer le type de document <strong>"{selectedItem.libelle}"</strong> ? Cette action est irréversible.</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
              <button onClick={() => setShowSupprimerModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                Annuler
              </button>
              <button onClick={handleSupprimer} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}