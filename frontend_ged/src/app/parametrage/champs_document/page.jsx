// app/parametrage/champs_document/page.jsx
// Page de gestion des champs dynamiques par type de document.
// Inclut un accès vers la configuration des zones de capture (style Dokmee).
"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";

import {
  getChampsDocuments,
  createChampsDocument,
  updateChampsDocument,
  deleteChampsDocument
} from "../../../services/champsDocument.service";
import { getTypeDocuments } from "../../../services/typeDocument.service";
import { useCrudPermissions, MODELS } from "../../../utils/permissions";


const FIELD_TYPES = [
  { value: 'texte', label: 'Texte court' },
  { value: 'texte_long', label: 'Texte long ' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date et heure' },
  { value: 'choix', label: 'Choix multiple' },
  { value: 'select', label: 'Liste déroulante' },
  { value: 'qr', label: 'Code QR' },
  { value: 'code_barre', label: 'Code barre' },
];

const LEGACY_FIELD_TYPES = [
  { value: 'fichier', label: 'Fichier (obsolète)' },
];

export default function ChampsDocumentPage() {
  const router = useRouter();
  const { canAdd, canChange, canDelete } = useCrudPermissions(MODELS.CHAMPS_DOCUMENT);
  const showFieldActions = canChange || canDelete;

  const [typeDocuments, setTypeDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState({});
  const [fieldsMap, setFieldsMap] = useState({});
  const [loadingFields, setLoadingFields] = useState({});

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [selectedTypeDoc, setSelectedTypeDoc] = useState(null);
  const [selectedField, setSelectedField] = useState(null);

  const [formData, setFormData] = useState({
    libelle_champ: "",
    type_champ: "texte",
    obligatoire: false,
    ordre: 1,
    options: []
  });
  const [newOptionValue, setNewOptionValue] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTypeDocuments();
  }, []);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadTypeDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTypeDocuments();
      setTypeDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des types de documents");
      showNotification(err.message || "Erreur de chargement", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async (typeDocId) => {
    try {
      setLoadingFields(prev => ({ ...prev, [typeDocId]: true }));
      const data = await getChampsDocuments(typeDocId);
      const sorted = Array.isArray(data) ? data.sort((a, b) => a.ordre - b.ordre) : [];
      setFieldsMap(prev => ({ ...prev, [typeDocId]: sorted }));
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors du chargement des champs", "error");
    } finally {
      setLoadingFields(prev => ({ ...prev, [typeDocId]: false }));
    }
  };

  const toggleRow = async (typeDocId) => {
    const isCurrentlyExpanded = !!expandedRows[typeDocId];
    setExpandedRows(prev => ({ ...prev, [typeDocId]: !isCurrentlyExpanded }));
    
    if (!isCurrentlyExpanded) {
      await loadFields(typeDocId);
    }
  };

  const openAddModal = (typeDoc) => {
    setSelectedTypeDoc(typeDoc);
    const currentFields = fieldsMap[typeDoc.id] || [];
    const nextOrder = currentFields.length > 0 
      ? Math.max(...currentFields.map(f => f.ordre)) + 1 
      : 1;

    setFormData({
      libelle_champ: "",
      type_champ: "texte",
      obligatoire: false,
      ordre: nextOrder,
      options: []
    });
    setNewOptionValue("");
    setFormErrors({});
    setSubmitting(false);
    setShowAddModal(true);
  };

  const openEditModal = (typeDoc, field) => {
    setSelectedTypeDoc(typeDoc);
    setSelectedField(field);
    setFormData({
      libelle_champ: field.libelle_champ,
      type_champ: field.type_champ,
      obligatoire: field.obligatoire,
      ordre: field.ordre,
      options: field.options ? field.options.map(opt => ({ valeur: opt.valeur })) : []
    });
    setNewOptionValue("");
    setFormErrors({});
    setShowEditModal(true);
  };

  const openDeleteModal = (typeDoc, field) => {
    setSelectedTypeDoc(typeDoc);
    setSelectedField(field);
    setShowDeleteModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAddOption = (e) => {
    e.preventDefault();
    if (!newOptionValue.trim()) return;

    if (formData.options.some(opt => opt.valeur.toLowerCase() === newOptionValue.trim().toLowerCase())) {
      showNotification("Cette option existe déjà", "error");
      return;
    }

    setFormData(prev => ({
      ...prev,
      options: [...prev.options, { valeur: newOptionValue.trim() }]
    }));
    setNewOptionValue("");
  };

  const handleRemoveOption = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.libelle_champ.trim()) {
      errors.libelle_champ = "Le libellé du champ est requis";
    }

    const ordre = parseInt(formData.ordre, 10);
    if (!formData.ordre || Number.isNaN(ordre) || ordre < 1) {
      errors.ordre = "L'ordre doit être un nombre supérieur ou égal à 1";
    }

    if (['choix', 'select'].includes(formData.type_champ) && formData.options.length === 0) {
      errors.options = "Veuillez ajouter au moins une option pour ce type de champ";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSubmit = async (e, continueAdding = false) => {
    e.preventDefault();
    if (!validateForm() || submitting) return;

    try {
      setSubmitting(true);
      const payload = {
        type_document: selectedTypeDoc.id,
        libelle_champ: formData.libelle_champ.trim(),
        type_champ: formData.type_champ,
        obligatoire: formData.obligatoire,
        ordre: parseInt(formData.ordre),
        options: ['choix', 'select'].includes(formData.type_champ) ? formData.options : []
      };

      await createChampsDocument(payload);

      if (!continueAdding) {
        setShowAddModal(false);
      } else {
        const nextOrder = parseInt(formData.ordre, 10) + 1;
        setFormData({
          libelle_champ: "",
          type_champ: "texte",
          obligatoire: false,
          ordre: nextOrder,
          options: []
        });
        setNewOptionValue("");
        setFormErrors({});
      }

      showNotification(
        continueAdding ? "Champ ajouté — saisissez le suivant" : "Champ ajouté avec succès",
        "success"
      );

      if (!expandedRows[selectedTypeDoc.id]) {
        setExpandedRows(prev => ({ ...prev, [selectedTypeDoc.id]: true }));
      }
      await loadFields(selectedTypeDoc.id);
      await loadTypeDocuments();
    } catch (err) {
      console.error(err);
      showNotification(err.message || "Erreur lors de l'ajout", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const payload = {
        type_document: selectedTypeDoc.id,
        libelle_champ: formData.libelle_champ.trim(),
        type_champ: formData.type_champ,
        obligatoire: formData.obligatoire,
        ordre: parseInt(formData.ordre),
        options: ['choix', 'select'].includes(formData.type_champ) ? formData.options : []
      };

      await updateChampsDocument(selectedField.id, payload);
      setShowEditModal(false);
      showNotification("Champ mis à jour avec succès", "success");
      await loadFields(selectedTypeDoc.id);
    } catch (err) {
      console.error(err);
      showNotification(err.message || "Erreur lors de la modification", "error");
    }
  };

  const handleDeleteSubmit = async () => {
    try {
      await deleteChampsDocument(selectedField.id);
      setShowDeleteModal(false);
      showNotification("Champ supprimé avec succès", "success");
      await loadFields(selectedTypeDoc.id);
      await loadTypeDocuments(); // to update count (n)
    } catch (err) {
      console.error(err);
      showNotification(err.message || "Erreur lors de la suppression", "error");
    }
  };

  const buildChampPayload = (typeDocId, field, ordre) => ({
    type_document: typeDocId,
    libelle_champ: field.libelle_champ,
    type_champ: field.type_champ,
    obligatoire: field.obligatoire,
    ordre,
    options: field.options ? field.options.map(o => ({ valeur: o.valeur })) : []
  });

  const handleMove = async (typeDocId, index, direction) => {
    const currentFields = fieldsMap[typeDocId] || [];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentFields.length) return;

    const item1 = currentFields[index];
    const item2 = currentFields[newIndex];

    try {
      await updateChampsDocument(
        item1.id,
        buildChampPayload(typeDocId, item1, item2.ordre)
      );

      showNotification("Ordre mis à jour", "success");
      await loadFields(typeDocId);
    } catch (err) {
      console.error("Erreur réorganisation ordre:", err);
      showNotification("Erreur lors de la réorganisation", "error");
    }
  };

  const getBadgeClass = (type) => {
    switch (type) {
      case 'texte': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'texte_long': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'nombre': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'date': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'datetime': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'choix': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'select': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'qr': return 'bg-teal-50 text-teal-700 border-teal-100';
      case 'code_barre': return 'bg-cyan-50 text-cyan-700 border-cyan-100';
      case 'fichier': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeName = (type) => {
    const found = FIELD_TYPES.find(t => t.value === type)
      || LEGACY_FIELD_TYPES.find(t => t.value === type);
    return found ? found.label : type;
  };

  const getFieldTypeOptions = (currentType) => {
    const options = [...FIELD_TYPES];
    if (currentType && !options.some((t) => t.value === currentType)) {
      const legacy = LEGACY_FIELD_TYPES.find((t) => t.value === currentType);
      if (legacy) options.push(legacy);
    }
    return options;
  };

  const filteredTypeDocs = typeDocuments.filter(item => 
    item.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.libelle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Notification */}
      {notification && (
        <div className="fixed top-20 right-5 z-[99999] animate-slide-in-right">
          <div className={`
            min-w-[300px] max-w-[500px] p-4 rounded-lg shadow-lg flex items-center gap-3
            ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}
            text-white
          `}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {notification.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Champs documents</h1>
            <nav className="mt-2">
              <ol className="flex items-center gap-2 text-sm text-gray-500">
                <li>
                  <button onClick={() => router.push('/dashboard')} className="hover:text-blue-600 transition">
                    Accueil
                  </button>
                </li>
                <li><span>/</span></li>
                <li className="text-gray-400">Paramétrage</li>
                <li><span>/</span></li>
                <li className="text-gray-700 font-medium">Champs documents</li>
              </ol>
            </nav>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <h5 className="text-lg font-semibold text-gray-800">
              Configuration des champs par type de document
            </h5>
            <div className="w-80 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                placeholder="Rechercher un type de document..."
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm text-gray-500 bg-white"
                  title="Effacer la recherche"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-500">Chargement des types de documents...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-500 mb-4">{error}</p>
                <button onClick={loadTypeDocuments} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                  Réessayer
                </button>
              </div>
            ) : filteredTypeDocs.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                Aucun type de document trouvé.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white text-sm">
                      <th className="border border-gray-700 px-4 py-3 text-left w-[80px]">N°</th>
                      <th className="border border-gray-700 px-4 py-3 text-left w-[150px]">Code</th>
                      <th className="border border-gray-700 px-4 py-3 text-left">Libellé du type</th>
                      <th className="border border-gray-700 px-4 py-3 text-center w-[380px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredTypeDocs.map((item, index) => {
                      const isExpanded = !!expandedRows[item.id];
                      const fields = fieldsMap[item.id] || [];
                      const isFieldsLoading = !!loadingFields[item.id];
                      const n = item.champs_count || 0;

                      return (
                        <Fragment key={item.id}>
                          {/* Row principal */}
                          <tr className="hover:bg-slate-50/40 transition-colors text-sm font-medium">
                            <td className="border border-gray-300 px-4 py-3 text-gray-500">{index + 1}</td>
                            <td className="border border-gray-300 px-4 py-3">
                              <span className="bg-blue-50 text-blue-800 text-xs px-2.5 py-1 rounded border border-blue-100 font-mono font-bold uppercase">
                                {item.code}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-gray-800 font-semibold">{item.libelle}</td>
                            <td className="border border-gray-300 px-4 py-3 text-center">
                              <div className="flex justify-center gap-2">
                                {/* Bouton Voir (n) */}
                                <button
                                  onClick={() => toggleRow(item.id)}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 shadow-sm
                                    ${isExpanded 
                                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }
                                  `}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {isExpanded ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    ) : (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    )}
                                  </svg>
                                  Voir ({n})
                                </button>

                                {canAdd && (
                                <button
                                  onClick={() => openAddModal(item)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Ajouter champ
                                </button>
                                )}

                                {canChange && n > 0 && (
                                <button
                                  onClick={() => router.push(`/parametrage/champs_document/${item.id}/zones`)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm"
                                  title="Configurer les zones de capture (style Dokmee)"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                                  </svg>
                                  Zones capture
                                </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Row de sous-tableau si expansé */}
                          {isExpanded && (
                            <tr key={item.id + '-sub'} className="bg-slate-50/50">
                              <td colSpan="4" className="border border-gray-300 px-6 py-4">
                                <div className="pl-4 border-l-2 border-blue-500">
                                  <div className="flex justify-between items-center mb-3">
                                    <h6 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                      Champs configurés pour : {item.libelle}
                                    </h6>
                                  </div>

                                  {isFieldsLoading ? (
                                    <div className="text-center py-4 text-xs text-slate-500">
                                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                      Chargement des champs associés...
                                    </div>
                                  ) : fields.length === 0 ? (
                                    <div className="text-sm text-slate-500 italic py-2">
                                      Aucun champ n'est encore associé à ce type de document.
                                      {canAdd && (
                                        <>
                                          {" "}
                                          Cliquer sur{" "}
                                          <span className="font-semibold text-indigo-600 cursor-pointer" onClick={() => openAddModal(item)}>
                                            Ajouter champ
                                          </span>{" "}
                                          pour commencer.
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white shadow-sm">
                                      <table className="w-full border-collapse">
                                        <thead>
                                          <tr className="bg-blue-600 text-white text-xs font-bold border-b border-blue-700">
                                            <th className="border border-blue-700 px-3 py-2 text-left w-[60px]">Ordre</th>
                                            <th className="border border-blue-700 px-3 py-2 text-left">Libellé</th>
                                            <th className="border border-blue-700 px-3 py-2 text-left w-[140px]">Type</th>
                                            <th className="border border-blue-700 px-3 py-2 text-center w-[100px]">Obligatoire</th>
                                            <th className="border border-blue-700 px-3 py-2 text-left">Options de choix</th>
                                            {showFieldActions && (
                                            <th className="border border-blue-700 px-3 py-2 text-center w-[220px]">Actions</th>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                          {fields.map((field, fIdx) => (
                                            <tr key={field.id} className="hover:bg-slate-50/50 text-xs">
                                              <td className="border border-slate-200 px-3 py-2 font-mono font-bold text-slate-500">
                                                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                  {field.ordre}
                                                </span>
                                              </td>
                                              <td className="border border-slate-200 px-3 py-2 font-medium text-slate-800">{field.libelle_champ}</td>
                                              <td className="border border-slate-200 px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(field.type_champ)}`}>
                                                  {getTypeName(field.type_champ)}
                                                </span>
                                              </td>
                                              <td className="border border-slate-200 px-3 py-2 text-center">
                                                {field.obligatoire ? (
                                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                                                    Oui
                                                  </span>
                                                ) : (
                                                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 border border-slate-200">
                                                    Non
                                                  </span>
                                                )}
                                              </td>
                                              <td className="border border-slate-200 px-3 py-2 text-slate-600 max-w-[200px] truncate">
                                                {['choix', 'select'].includes(field.type_champ) ? (
                                                  <div className="flex flex-wrap gap-1">
                                                    {field.options && field.options.map((opt, i) => (
                                                      <span key={i} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-gray-200">
                                                        {opt.valeur}
                                                      </span>
                                                    ))}
                                                    {(!field.options || field.options.length === 0) && (
                                                      <span className="text-red-500 text-[10px] italic font-semibold">Aucune option</span>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <span className="text-slate-400 font-mono">-</span>
                                                )}
                                              </td>
                                              {showFieldActions && (
                                              <td className="border border-slate-200 px-3 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                  {canChange && (
                                                  <>
                                                  <button
                                                    onClick={() => handleMove(item.id, fIdx, 'up')}
                                                    disabled={fIdx === 0}
                                                    className="p-1 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                                                    title="Monter"
                                                  >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                  </button>
                                                  <button
                                                    onClick={() => handleMove(item.id, fIdx, 'down')}
                                                    disabled={fIdx === fields.length - 1}
                                                    className="p-1 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                                                    title="Descendre"
                                                  >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                  </button>
                                                  
                                                  <button
                                                    onClick={() => openEditModal(item, field)}
                                                    className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-semibold transition flex items-center gap-0.5 ml-1"
                                                  >
                                                    Modifier
                                                  </button>
                                                  </>
                                                  )}
                                                  {canDelete && (
                                                  <button
                                                    onClick={() => openDeleteModal(item, field)}
                                                    className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-semibold transition flex items-center gap-0.5"
                                                  >
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
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Ajouter un Champ */}
      {showAddModal && selectedTypeDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto animate-zoom-in">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-t-lg flex justify-between items-center sticky top-0">
              <div>
                <h5 className="text-lg font-semibold">Nouveau champ de document</h5>
                <p className="text-xs text-blue-100 mt-0.5">Type associé : {selectedTypeDoc.libelle}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-white hover:text-red-200 text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={(e) => handleAddSubmit(e, false)}>
              <div className="p-6 text-sm">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Libellé du champ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="libelle_champ"
                    value={formData.libelle_champ}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.libelle_champ ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ex: Date de signature, Nom complet, Montant"
                    required
                  />
                  {formErrors.libelle_champ && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.libelle_champ}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Type de données
                    </label>
                    <select
                      name="type_champ"
                      value={formData.type_champ}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {getFieldTypeOptions(formData.type_champ).map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Ordre d'affichage
                    </label>
                    <input
                      type="number"
                      name="ordre"
                      value={formData.ordre}
                      onChange={handleInputChange}
                      min="1"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.ordre ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    />
                    
                    {formErrors.ordre && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.ordre}</p>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="inline-flex items-center cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      name="obligatoire"
                      checked={formData.obligatoire}
                      onChange={handleInputChange}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ms-3 text-sm font-semibold text-gray-700">Ce champ est obligatoire</span>
                  </label>
                </div>

                {/* Section Options pour Choix et Select */}
                {['choix', 'select'].includes(formData.type_champ) && (
                  <div className="mt-5 p-4 border border-blue-100 bg-blue-50/40 rounded-lg animate-fade-in">
                    <h6 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-1.5">
                      Options de la liste de choix
                    </h6>

                    {/* Options list */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.options.map((option, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-white text-gray-800 text-xs px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                          {option.valeur}
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="text-red-500 hover:text-red-700 font-bold ml-1 text-sm focus:outline-none"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      {formData.options.length === 0 && (
                        <p className="text-xs text-slate-500 italic py-1">Aucune option ajoutée pour le moment. Veuillez saisir des options ci-dessous.</p>
                      )}
                    </div>

                    {/* Add option form */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOptionValue}
                        onChange={(e) => setNewOptionValue(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        placeholder="Ex: Option..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddOption(e);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                      >
                        Ajouter
                      </button>
                    </div>
                    {formErrors.options && (
                      <p className="mt-1.5 text-xs text-red-600">{formErrors.options}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={(e) => handleAddSubmit(e, true)}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition"
                >
                  {submitting ? "Enregistrement..." : "Ajouter & continuer"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition"
                >
                  {submitting ? "Enregistrement..." : "Ajouter & fermer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modifier un Champ */}
      {showEditModal && selectedTypeDoc && selectedField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl overflow-hidden animate-zoom-in">
            <div className="bg-green-600 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h5 className="text-base font-bold">Modifier le champ</h5>
                <p className="text-xs text-green-100 mt-0.5">Type associé : {selectedTypeDoc.libelle}</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-white hover:text-green-200 transition text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div className="p-6 max-h-[75vh] overflow-y-auto text-sm">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Libellé du champ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="libelle_champ"
                    value={formData.libelle_champ}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      formErrors.libelle_champ ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ex: Date de signature, Nom complet, Montant"
                    required
                  />
                  {formErrors.libelle_champ && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.libelle_champ}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Type de données
                    </label>
                    <select
                      name="type_champ"
                      value={formData.type_champ}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      {getFieldTypeOptions(formData.type_champ).map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Ordre d'affichage
                    </label>
                    <input
                      type="number"
                      name="ordre"
                      value={formData.ordre}
                      onChange={handleInputChange}
                      min="1"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        formErrors.ordre ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    />
                    
                    {formErrors.ordre && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.ordre}</p>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="inline-flex items-center cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      name="obligatoire"
                      checked={formData.obligatoire}
                      onChange={handleInputChange}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    <span className="ms-3 text-sm font-semibold text-slate-700">Ce champ est obligatoire</span>
                  </label>
                </div>

                {/* Section Options pour Choix et Select */}
                {['choix', 'select'].includes(formData.type_champ) && (
                  <div className="mt-5 p-4 border border-green-100 bg-green-50/40 rounded-lg animate-fade-in">
                    <h6 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-1.5">
                      Options de la liste de choix
                    </h6>

                    {/* Options list */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.options.map((option, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-white text-gray-800 text-xs px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm">
                          {option.valeur}
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="text-red-500 hover:text-red-700 font-bold ml-1 text-sm focus:outline-none"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      {formData.options.length === 0 && (
                        <p className="text-xs text-gray-500 italic py-1">Aucune option ajoutée pour le moment. Veuillez saisir des options ci-dessous.</p>
                      )}
                    </div>

                    {/* Add option form */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOptionValue}
                        onChange={(e) => setNewOptionValue(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        placeholder="Ex: Option..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddOption(e);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                      >
                        Ajouter
                      </button>
                    </div>
                    {formErrors.options && (
                      <p className="mt-1.5 text-xs text-red-600">{formErrors.options}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Supprimer un Champ */}
      {showDeleteModal && selectedTypeDoc && selectedField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000] p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl overflow-hidden animate-zoom-in">
            <div className="bg-red-600 text-white px-6 py-3 flex justify-between items-center">
              <h5 className="text-lg font-bold">Supprimer le champ ?</h5>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="text-white hover:text-red-200 transition text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 text-sm">
                Êtes-vous sûr de vouloir supprimer le champ <strong>"{selectedField.libelle_champ}"</strong> pour le type de document <strong>"{selectedTypeDoc.libelle}"</strong> ? 
                Cette action supprimera également toutes les valeurs associées à ce champ dans les documents existants.
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition shadow-sm"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animations CSS */}
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

        @keyframes zoomIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-zoom-in {
          animation: zoomIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
