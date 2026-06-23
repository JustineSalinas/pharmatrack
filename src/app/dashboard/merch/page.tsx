"use client";

import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Shirt,
  Tag,
  Sparkles,
  X,
  Search,
  Layers,
  Grid,
  Info,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import {
  type MerchItem,
  type ProductRow,
  type ProductDraft,
  parseCommaList,
  parseLineList,
  mapRowToMerchItem,
  toProductRecord,
  uploadMerchImages,
} from "@/lib/merch";

export default function MerchCataloguePage() {
  const [merchItems, setMerchItems] = useState<MerchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "apparel" | "accessories">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MerchItem | null>(null);
  const [user, setUser] = useState<any>(null);

  // Add product form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"apparel" | "accessories">("apparel");
  const [newPrice, setNewPrice] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<"Showcase Only" | "Coming Soon">("Showcase Only");
  const [newMaterial, setNewMaterial] = useState("");
  const [newSizes, setNewSizes] = useState("");
  const [newColors, setNewColors] = useState("");
  const [newFeatures, setNewFeatures] = useState("");
  const [newImagesList, setNewImagesList] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<Map<string, File>>(new Map());

  // Delete confirmation state
  const [deletingItem, setDeletingItem] = useState<MerchItem | null>(null);

  // Edit product form states
  const [editingItem, setEditingItem] = useState<MerchItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<"apparel" | "accessories">("apparel");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<"Showcase Only" | "Coming Soon">("Showcase Only");
  const [editMaterial, setEditMaterial] = useState("");
  const [editSizes, setEditSizes] = useState("");
  const [editColors, setEditColors] = useState("");
  const [editFeatures, setEditFeatures] = useState("");
  const [editImagesList, setEditImagesList] = useState<string[]>([]);

  // Lightbox carousel state
  const [activeImage, setActiveImage] = useState<string>("");

  const getItemImages = (item: MerchItem): string[] => {
    if (item.images && item.images.length > 0) {
      return item.images;
    }
    return [item.image];
  };

  useEffect(() => {
    if (selectedItem) {
      const imgs = getItemImages(selectedItem);
      setActiveImage(imgs[0]);
    } else {
      setActiveImage("");
    }
  }, [selectedItem]);

  useEffect(() => {
    async function loadUser() {
      try {
        const u = await getCurrentUser();
        setUser(u);
      } catch (err) {
        console.error("Failed to load user in merch catalogue", err);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        setActionError("Failed to load merchandise. Please refresh the page.");
      } else {
        setMerchItems((data as ProductRow[]).map(mapRowToMerchItem));
      }
      setLoading(false);
    }
    loadProducts();
  }, []);

  const canManage = user?.account_type === "facilitator" || user?.account_type === "admin";

  const handleAddImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const urls: string[] = [];
      const fileMap = new Map(newImageFiles);
      for (let i = 0; i < files.length; i++) {
        const url = URL.createObjectURL(files[i]);
        urls.push(url);
        fileMap.set(url, files[i]);
      }
      setNewImagesList([...newImagesList, ...urls]);
      setNewImageFiles(fileMap);
    }
  };

  const handleAddPresetImage = (url: string) => {
    if (url && !newImagesList.includes(url)) {
      setNewImagesList([...newImagesList, url]);
    }
  };

  const handleEditImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        urls.push(URL.createObjectURL(files[i]));
      }
      setEditImagesList([...editImagesList, ...urls]);
    }
  };

  const handleEditPresetImage = (url: string) => {
    if (url && !editImagesList.includes(url)) {
      setEditImagesList([...editImagesList, url]);
    }
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;

    setSubmitting(true);
    setActionError(null);
    try {
      const pendingFiles = newImagesList
        .map((url) => newImageFiles.get(url))
        .filter((f): f is File => f !== undefined);
      const uploadedUrls = pendingFiles.length > 0
        ? await uploadMerchImages(pendingFiles, supabase.storage.from("merch-images"))
        : [];
      let uploadIdx = 0;
      const finalImages = newImagesList.map((url) =>
        newImageFiles.has(url) ? uploadedUrls[uploadIdx++] : url
      );

      const draft: ProductDraft = {
        name: newName,
        category: newCategory,
        pricePlaceholder: newPrice,
        description: newDescription,
        status: newStatus,
        material: newMaterial,
        sizes: parseCommaList(newSizes),
        colors: parseCommaList(newColors),
        features: parseLineList(newFeatures),
        images: finalImages,
      };

      const { data, error } = await supabase
        .from("products")
        .insert({ ...toProductRecord(draft), created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      setMerchItems([mapRowToMerchItem(data as ProductRow), ...merchItems]);

      // Reset Form
      setNewName("");
      setNewCategory("apparel");
      setNewPrice("");
      setNewDescription("");
      setNewStatus("Showcase Only");
      setNewMaterial("");
      setNewSizes("");
      setNewColors("");
      setNewFeatures("");
      setNewImagesList([]);
      setNewImageFiles(new Map());

      // Close Modal
      setShowAddModal(false);
    } catch (err: any) {
      setActionError(err.message || "Failed to add product. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProductClick = (item: MerchItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditPrice(item.pricePlaceholder);
    setEditDescription(item.description);
    setEditStatus(item.status);
    setEditMaterial(item.details.material);
    setEditSizes(item.details.sizes ? item.details.sizes.join(", ") : "");
    setEditColors(item.details.colors.join(", "));
    setEditFeatures(item.details.features.join("\n"));
    setEditImagesList(item.images && item.images.length > 0 ? item.images : [item.image]);
  };

  const handleEditProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const details = {
      material: editMaterial || "N/A",
      sizes: editSizes ? editSizes.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      colors: editColors ? editColors.split(",").map(c => c.trim()).filter(Boolean) : ["N/A"],
      features: editFeatures ? editFeatures.split("\n").map(f => f.trim()).filter(Boolean) : ["N/A"]
    };

    let finalImages = editImagesList.length > 0 ? editImagesList : ["/merch/shirt.png"];
    let primaryImage = finalImages[0];

    const updatedItem: MerchItem = {
      ...editingItem,
      name: editName,
      category: editCategory,
      pricePlaceholder: editPrice ? (editPrice.toUpperCase().startsWith("PHP") ? editPrice : `PHP ${editPrice}`) : "PHP 0.00",
      image: primaryImage,
      images: finalImages,
      description: editDescription || "No description provided.",
      status: editStatus,
      details
    };

    setMerchItems(merchItems.map(item => item.id === editingItem.id ? updatedItem : item));
    
    if (selectedItem?.id === editingItem.id) {
      setSelectedItem(updatedItem);
    }

    setEditingItem(null);
  };

  const handleDeleteProductClick = (item: MerchItem) => {
    setDeletingItem(item);
  };

  const confirmDeleteProduct = () => {
    if (!deletingItem) return;
    setMerchItems(merchItems.filter(item => item.id !== deletingItem.id));
    if (selectedItem?.id === deletingItem.id) {
      setSelectedItem(null);
    }
    setDeletingItem(null);
  };

  const filteredItems = merchItems.filter((item) => {
    const matchesFilter = filter === "all" || item.category === filter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  return (
    <div className="fade-in sd-root" style={{ paddingBottom: "60px" }}>
      {/* Header */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Official Showcase</p>
          <h1 className="sd-header-title">Merch Catalogue</h1>
        </div>
      </header>

      {actionError && (
        <div className="sp-error-banner">
          <AlertTriangle size={16} /> {actionError}
        </div>
      )}

      {/* Controls Bar */}
      <div className="mc-controls">
        {/* Category Filters */}
        <div className="mc-filters">
          <button 
            className={`mc-filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            <Grid size={15} />
            <span>All Items</span>
          </button>
          <button 
            className={`mc-filter-btn ${filter === "apparel" ? "active" : ""}`}
            onClick={() => setFilter("apparel")}
          >
            <Shirt size={15} />
            <span>Apparel</span>
          </button>
          <button 
            className={`mc-filter-btn ${filter === "accessories" ? "active" : ""}`}
            onClick={() => setFilter("accessories")}
          >
            <Tag size={15} />
            <span>Accessories</span>
          </button>
        </div>

        {/* Search & Actions */}
        <div className="mc-search-actions-group">
          <div className="mc-search-wrap" style={{ position: "relative" }}>
            <Search 
              size={16} 
              className="mc-search-icon" 
              style={{ 
                position: "absolute", 
                left: "12px", 
                top: "50%", 
                transform: "translateY(-50%)", 
                color: "#000000", 
                pointerEvents: "none",
                zIndex: 10
              }} 
            />
            <input
              type="text"
              className="mc-search-input"
              style={{ paddingLeft: "36px", paddingRight: "12px" }}
              placeholder="Search merchandise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canManage && (
            <button className="mc-add-btn" onClick={() => setShowAddModal(true)}>
              <Plus size={15} />
              <span>Add new product</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout */}
      {filteredItems.length === 0 ? (
        <div className="mc-empty-state">
          <ShoppingBag size={48} className="mc-empty-icon" />
          <h3>No merchandise found</h3>
          <p>We couldn't find any items matching your current filters or search query.</p>
        </div>
      ) : (
        <div className="mc-grid">
          {filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="mc-card"
              onClick={() => setSelectedItem(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelectedItem(item);
                }
              }}
            >
              {/* Image Frame */}
              <div className="mc-card-image-frame">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="mc-card-image"
                />
                <span className={`mc-card-status ${item.status === "Coming Soon" ? "status-soon" : "status-showcase"}`}>
                  <Sparkles size={11} />
                  <span>{item.status}</span>
                </span>

                {canManage && (
                  <div className="mc-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="mc-card-action-btn edit-btn"
                      title="Edit Product"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditProductClick(item);
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button 
                      className="mc-card-action-btn delete-btn"
                      title="Delete Product"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProductClick(item);
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Info Frame */}
              <div className="mc-card-info">
                <div className="mc-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span className="mc-card-category" style={{ fontSize: "10px", fontWeight: 700, color: "#7c3aed", background: "rgba(124, 58, 237, 0.06)", padding: "3px 9px", borderRadius: "99px", letterSpacing: "0.5px" }}>{item.category.toUpperCase()}</span>
                  <span className="mc-card-price" style={{ fontSize: "13px", fontWeight: 700, color: "#7c3aed", letterSpacing: "-0.01em" }}>{item.pricePlaceholder}</span>
                </div>
                <h3 className="mc-card-title">{item.name}</h3>
                <p className="mc-card-desc">{item.description}</p>
                
                <button className="mc-card-btn">
                  <Search size={13} />
                  <span>View Details</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Modal */}
      {selectedItem && (
        <div 
          className="mc-modal-overlay"
          onClick={() => setSelectedItem(null)}
        >
          <div 
            className="mc-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              className="mc-modal-close"
              onClick={() => setSelectedItem(null)}
              aria-label="Close details"
            >
              <X size={20} />
            </button>

            {/* Modal Content Grid */}
            <div className="mc-modal-grid">
              {/* Product Visual */}
              <div className="mc-modal-visual" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", width: "100%", flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img 
                    src={activeImage} 
                    alt={selectedItem.name} 
                    className="mc-modal-image"
                  />
                  <span className={`mc-modal-status ${selectedItem.status === "Coming Soon" ? "status-soon" : "status-showcase"}`}>
                    <Sparkles size={12} />
                    <span>{selectedItem.status}</span>
                  </span>
                </div>
                {getItemImages(selectedItem).length > 1 && (
                  <div className="mc-thumbnails-row" style={{ display: "flex", gap: "8px", padding: "12px", background: "rgba(0,0,0,0.02)", borderTop: "1px solid var(--border)", width: "100%", justifyContent: "center", flexWrap: "wrap" }}>
                    {getItemImages(selectedItem).map((imgUrl: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => setActiveImage(imgUrl)}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "6px",
                          border: activeImage === imgUrl ? "2px solid #7c3aed" : "1px solid var(--border)",
                          background: "var(--surface)",
                          padding: 0,
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <img src={imgUrl} alt={`Thumbnail ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Specs */}
              <div className="mc-modal-specs">
                <div>
                  <span className="mc-modal-category">{selectedItem.category.toUpperCase()}</span>
                  <h2 className="mc-modal-title">{selectedItem.name}</h2>
                  <div className="mc-modal-price">{selectedItem.pricePlaceholder}</div>
                </div>

                <p className="mc-modal-desc">{selectedItem.description}</p>

                <hr className="mc-modal-divider" />

                {/* Specs List */}
                <div className="mc-specs-list">
                  <div className="mc-spec-row">
                    <span className="mc-spec-label">Material & Quality</span>
                    <span className="mc-spec-value">{selectedItem.details.material}</span>
                  </div>

                  {selectedItem.details.sizes && (
                    <div className="mc-spec-row">
                      <span className="mc-spec-label">Available Sizes</span>
                      <div className="mc-sizes-row">
                        {selectedItem.details.sizes.map((s) => (
                          <span key={s} className="mc-size-chip">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mc-spec-row">
                    <span className="mc-spec-label">Color Options</span>
                    <span className="mc-spec-value">
                      {selectedItem.details.colors.join(", ")}
                    </span>
                  </div>

                  <div className="mc-spec-row">
                    <span className="mc-spec-label">Design Features</span>
                    <ul className="mc-features-list">
                      {selectedItem.details.features.map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Warning note */}
                <div className="mc-modal-notice">
                  <Info size={14} className="mc-notice-icon" />
                  <span>This item cannot be ordered or purchased online.</span>
                </div>

                {/* Facilitator actions */}
                {canManage && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button 
                      className="mc-add-btn" 
                      style={{ flex: 1, justifyContent: "center", background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", border: "1px solid rgba(124, 58, 237, 0.2)" }}
                      onClick={() => handleEditProductClick(selectedItem)}
                    >
                      <Pencil size={14} />
                      <span>Edit Product</span>
                    </button>
                    <button 
                      className="mc-add-btn" 
                      style={{ flex: 1, justifyContent: "center", background: "#dc2626" }}
                      onClick={() => handleDeleteProductClick(selectedItem)}
                    >
                      <Trash2 size={14} />
                      <span>Delete Product</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="mc-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="mc-form-card" onClick={(e) => e.stopPropagation()}>
            <div className="mc-form-header">
              <h2 className="mc-form-title">Add New Product</h2>
              <button 
                className="mc-modal-close" 
                style={{ position: "static", width: "32px", height: "32px" }}
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddProductSubmit}>
              <div className="mc-form-body">
                <div className="mc-form-group">
                  <label>Product Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Pharmacy Premium Jacket" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    className="mc-form-input" 
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="mc-form-group">
                    <label>Category</label>
                    <select 
                      value={newCategory} 
                      onChange={e => setNewCategory(e.target.value as any)} 
                      className="mc-form-select"
                    >
                      <option value="apparel">Apparel</option>
                      <option value="accessories">Accessories</option>
                    </select>
                  </div>
                  <div className="mc-form-group">
                    <label>Price / Value</label>
                    <input 
                      type="text" 
                      placeholder="e.g. PHP 899.00" 
                      value={newPrice} 
                      onChange={e => setNewPrice(e.target.value)} 
                      className="mc-form-input" 
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="mc-form-group">
                    <label>Showcase Status</label>
                    <select 
                      value={newStatus} 
                      onChange={e => setNewStatus(e.target.value as any)} 
                      className="mc-form-select"
                    >
                      <option value="Showcase Only">Showcase Only</option>
                      <option value="Coming Soon">Coming Soon</option>
                    </select>
                  </div>
                  <div className="mc-form-group">
                    <label>Material / Quality</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 100% Combed Cotton" 
                      value={newMaterial} 
                      onChange={e => setNewMaterial(e.target.value)} 
                      className="mc-form-input" 
                    />
                  </div>
                </div>

                <div className="mc-form-group">
                  <label>Description</label>
                  <textarea 
                    placeholder="Enter short description of the item..." 
                    value={newDescription} 
                    onChange={e => setNewDescription(e.target.value)} 
                    className="mc-form-textarea" 
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="mc-form-group">
                    <label>Available Sizes (comma-separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. S, M, L, XL" 
                      value={newSizes} 
                      onChange={e => setNewSizes(e.target.value)} 
                      className="mc-form-input" 
                    />
                  </div>
                  <div className="mc-form-group">
                    <label>Color Options (comma-separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. White, Forest Green" 
                      value={newColors} 
                      onChange={e => setNewColors(e.target.value)} 
                      className="mc-form-input" 
                    />
                  </div>
                </div>

                <div className="mc-form-group">
                  <label>Design Features (one per line)</label>
                  <textarea 
                    placeholder="e.g. Spacious front pocket&#10;Water-resistant fabric" 
                    value={newFeatures} 
                    onChange={e => setNewFeatures(e.target.value)} 
                    className="mc-form-textarea" 
                  />
                </div>

                <div className="mc-form-group">
                  <label>Product Showcase Pictures (First picture will be the primary cover)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {newImagesList.length > 0 && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "10px", background: "var(--surface2)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        {newImagesList.map((imgUrl, index) => (
                          <div key={index} style={{ position: "relative", width: "60px", height: "60px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border)" }}>
                            <img src={imgUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <button
                              type="button"
                              onClick={() => setNewImagesList(newImagesList.filter((_, i) => i !== index))}
                              style={{
                                position: "absolute",
                                top: "2px",
                                right: "2px",
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                background: "rgba(220, 38, 38, 0.9)",
                                color: "#ffffff",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                fontWeight: "bold",
                                cursor: "pointer",
                                padding: 0
                              }}
                              title="Remove image"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAddImageFile}
                        style={{ display: "none" }}
                        id="product-image-upload-multiple"
                      />
                      <label
                        htmlFor="product-image-upload-multiple"
                        className="mc-form-cancel-btn"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", height: "38px", margin: 0 }}
                      >
                        Upload Pictures
                      </label>
                      
                      <select
                        onChange={(e) => {
                          handleAddPresetImage(e.target.value);
                          e.target.value = "";
                        }}
                        className="mc-form-select"
                        value=""
                      >
                        <option value="" disabled>-- Or Add Preset Mockup --</option>
                        <option value="/merch/hoodie.png">Pharmacy Premium Hoodie</option>
                        <option value="/merch/shirt.png">Pharmacy Signature Shirt</option>
                        <option value="/merch/tote.png">Pharmacy Official Tote Bag</option>
                        <option value="/merch/lanyard.png">Pharmacy Event Lanyard</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mc-form-footer">
                <button 
                  type="button" 
                  className="mc-form-cancel-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="mc-form-submit-btn"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingItem && (
        <div className="mc-modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="mc-form-card" onClick={(e) => e.stopPropagation()}>
            <div className="mc-form-header">
              <h2 className="mc-form-title">Edit Product</h2>
              <button 
                className="mc-modal-close" 
                style={{ position: "static", width: "32px", height: "32px" }}
                onClick={() => setEditingItem(null)}
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditProductSubmit}>
              <div className="mc-form-body">
                <div className="mc-form-group">
                  <label>Product Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Pharmacy Premium Jacket" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    className="mc-form-input" 
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="mc-form-group">
                    <label>Category</label>
                    <select 
                      value={editCategory} 
                      onChange={e => setEditCategory(e.target.value as any)} 
                      className="mc-form-select"
                    >
                      <option value="apparel">Apparel</option>
                      <option value="accessories">Accessories</option>
                    </select>
                  </div>
                  <div className="mc-form-group">
                    <label>Price / Value</label>
                    <input 
                      type="text" 
                      placeholder="e.g. PHP 899.00" 
                      value={editPrice} 
                      onChange={e => setEditPrice(e.target.value)} 
                      className="mc-form-input" 
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="mc-form-group">
                    <label>Showcase Status</label>
                    <select 
                      value={editStatus} 
                      onChange={e => setEditStatus(e.target.value as any)} 
                      className="mc-form-select"
                    >
                      <option value="Showcase Only">Showcase Only</option>
                      <option value="Coming Soon">Coming Soon</option>
                    </select>
                  </div>
                  <div className="mc-form-group">
                    <label>Material / Quality</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 100% Combed Cotton" 
                      value={editMaterial} 
                      onChange={e => setEditMaterial(e.target.value)} 
                      className="mc-form-input" 
                    />
                  </div>
                </div>

                <div className="mc-form-group">
                  <label>Description</label>
                  <textarea 
                    placeholder="Enter short description of the item..." 
                    value={editDescription} 
                    onChange={e => setEditDescription(e.target.value)} 
                    className="mc-form-textarea" 
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="mc-form-group">
                    <label>Available Sizes (comma-separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. S, M, L, XL" 
                      value={editSizes} 
                      onChange={e => setEditSizes(e.target.value)} 
                      className="mc-form-input" 
                    />
                  </div>
                  <div className="mc-form-group">
                    <label>Color Options (comma-separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. White, Forest Green" 
                      value={editColors} 
                      onChange={e => setEditColors(e.target.value)} 
                      className="mc-form-input" 
                    />
                  </div>
                </div>

                <div className="mc-form-group">
                  <label>Design Features (one per line)</label>
                  <textarea 
                    placeholder="e.g. Spacious front pocket&#10;Water-resistant fabric" 
                    value={editFeatures} 
                    onChange={e => setEditFeatures(e.target.value)} 
                    className="mc-form-textarea" 
                  />
                </div>

                <div className="mc-form-group">
                  <label>Product Showcase Pictures (First picture will be the primary cover)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {editImagesList.length > 0 && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "10px", background: "var(--surface2)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        {editImagesList.map((imgUrl, index) => (
                          <div key={index} style={{ position: "relative", width: "60px", height: "60px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border)" }}>
                            <img src={imgUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <button
                              type="button"
                              onClick={() => setEditImagesList(editImagesList.filter((_, i) => i !== index))}
                              style={{
                                position: "absolute",
                                top: "2px",
                                right: "2px",
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                background: "rgba(220, 38, 38, 0.9)",
                                color: "#ffffff",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10px",
                                fontWeight: "bold",
                                cursor: "pointer",
                                padding: 0
                              }}
                              title="Remove image"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEditImageFile}
                        style={{ display: "none" }}
                        id="product-edit-image-upload-multiple"
                      />
                      <label
                        htmlFor="product-edit-image-upload-multiple"
                        className="mc-form-cancel-btn"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", height: "38px", margin: 0 }}
                      >
                        Upload Pictures
                      </label>
                      
                      <select
                        onChange={(e) => {
                          handleEditPresetImage(e.target.value);
                          e.target.value = "";
                        }}
                        className="mc-form-select"
                        value=""
                      >
                        <option value="" disabled>-- Or Add Preset Mockup --</option>
                        <option value="/merch/hoodie.png">Pharmacy Premium Hoodie</option>
                        <option value="/merch/shirt.png">Pharmacy Signature Shirt</option>
                        <option value="/merch/tote.png">Pharmacy Official Tote Bag</option>
                        <option value="/merch/lanyard.png">Pharmacy Event Lanyard</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mc-form-footer">
                <button 
                  type="button" 
                  className="mc-form-cancel-btn"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="mc-form-submit-btn"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="mc-modal-overlay" onClick={() => setDeletingItem(null)}>
          <div className="mc-delete-card" onClick={(e) => e.stopPropagation()}>
            <div className="mc-delete-icon-wrap">
              <Trash2 size={24} />
            </div>
            <h3 className="mc-delete-title">Delete Product?</h3>
            <p className="mc-delete-desc">
              Are you sure you want to delete <strong>{deletingItem.name}</strong> from the showcase? This action cannot be undone.
            </p>
            <div className="mc-delete-actions">
              <button
                className="mc-delete-cancel-btn"
                onClick={() => setDeletingItem(null)}
              >
                Cancel
              </button>
              <button
                className="mc-delete-confirm-btn"
                onClick={confirmDeleteProduct}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled JSX */}
      <style jsx>{`
        .mc-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 28px;
        }

        @media (max-width: 768px) {
          .mc-controls {
            flex-direction: column;
            align-items: stretch;
          }
        }

        .mc-filters {
          display: flex;
          gap: 8px;
        }

        .mc-filter-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .mc-filter-btn:hover {
          color: var(--white-shade);
          border-color: rgba(124, 58, 237, 0.25);
          background: var(--surface2);
        }

        .mc-filter-btn.active {
          color: #7c3aed;
          border-color: rgba(124, 58, 237, 0.3);
          background: rgba(124, 58, 237, 0.05);
          font-weight: 600;
        }

        .mc-search-wrap {
          position: relative;
          width: 300px;
        }

        @media (max-width: 768px) {
          .mc-search-wrap {
            width: 100%;
          }
        }

        :global(.mc-search-icon) {
          position: absolute;
          left: 12px;
          right: auto;
          top: 50%;
          transform: translateY(-50%);
          color: #000000 !important;
          pointer-events: none;
        }

        .mc-search-input {
          width: 100%;
          height: 38px;
          padding: 0 12px 0 36px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--white-shade);
          font-size: 13.5px;
          outline: none;
          transition: all 0.2s ease;
        }

        .mc-search-input:focus {
          border-color: rgba(124, 58, 237, 0.4);
          box-shadow: 0 0 12px rgba(124, 58, 237, 0.08);
        }

        .mc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }

        .mc-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          outline: none;
        }

        .mc-card:hover {
          transform: translateY(-4px);
          border-color: rgba(124, 58, 237, 0.25);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08), 0 0 20px rgba(124, 58, 237, 0.03);
        }

        .mc-card:focus-visible {
          border-color: var(--gold);
        }

        .mc-card-image-frame {
          position: relative;
          aspect-ratio: 1;
          background: var(--surface2);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-bottom: 1px solid var(--border);
        }

        .mc-card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .mc-card:hover .mc-card-image {
          transform: scale(1.03);
        }

        .mc-card-status {
          position: absolute;
          top: 12px;
          right: 12px;
          height: 22px;
          padding: 0 10px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 4px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition: all 0.2s ease;
        }

        .mc-card:hover .mc-card-status {
          opacity: 0;
          transform: translateY(-5px);
          pointer-events: none;
        }

        .status-soon {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
          color: #d97706;
        }

        .status-showcase {
          background: rgba(13, 148, 136, 0.1);
          border: 1px solid rgba(13, 148, 136, 0.25);
          color: #0d9488;
        }

        .mc-card-info {
          padding: 18px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .mc-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .mc-card-category {
          font-size: 10px;
          font-weight: 700;
          color: var(--gold);
          letter-spacing: 1px;
        }

        .mc-card-price {
          font-size: 12px;
          font-weight: 700;
          color: var(--gold);
          background: var(--gold-dim);
          border: 1px solid rgba(79, 70, 229, 0.15);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .mc-card-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--white-shade);
          margin-bottom: 8px;
          line-height: 1.3;
        }

        .mc-card-desc {
          font-size: 12.5px;
          color: var(--muted);
          line-height: 1.5;
          margin-bottom: 16px;
          flex-grow: 1;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .mc-card-btn {
          width: 100%;
          height: 38px;
          border-radius: var(--radius-sm);
          border: none;
          background: rgba(124, 58, 237, 0.05);
          color: #7c3aed;
          font-size: 12.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 12px;
        }

        .mc-card:hover .mc-card-btn {
          background: #7c3aed !important;
          color: #ffffff !important;
        }

        .mc-empty-state {
          padding: 80px 20px;
          text-align: center;
          background: rgba(0, 0, 0, 0.01);
          border: 1px dashed var(--border);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .mc-empty-icon {
          color: var(--dimmed);
          margin-bottom: 8px;
        }

        .mc-empty-state h3 {
          font-size: 16px;
          color: var(--white-shade);
          font-weight: 600;
        }

        .mc-empty-state p {
          font-size: 13.5px;
          color: var(--muted);
          max-width: 320px;
          margin: 0 auto;
        }

        /* Modal / Lightbox Styles */
        .mc-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeInOverlay 0.2s ease forwards;
        }

        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mc-modal-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          width: 100%;
          max-width: 820px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.8);
          animation: scaleUpCard 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes scaleUpCard {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .mc-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s ease;
        }

        .mc-modal-close:hover {
          color: #7c3aed;
          border-color: rgba(124, 58, 237, 0.25);
        }

        .mc-modal-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
        }

        @media (max-width: 768px) {
          .mc-modal-grid {
            grid-template-columns: 1fr;
            max-height: 85vh;
            overflow-y: auto;
          }
        }

        .mc-modal-visual {
          position: relative;
          background: var(--surface2);
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1px solid var(--border);
          min-width: 0;
        }

        @media (max-width: 768px) {
          .mc-modal-visual {
            border-right: none;
            border-bottom: 1px solid var(--border);
            aspect-ratio: 1;
          }
        }

        .mc-modal-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mc-modal-status {
          position: absolute;
          top: 16px;
          left: 16px;
          height: 24px;
          padding: 0 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 4px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .mc-modal-specs {
          padding: 36px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        @media (max-width: 768px) {
          .mc-modal-specs {
            padding: 24px;
          }
        }

        .mc-modal-category {
          font-size: 11px;
          font-weight: 700;
          color: #7c3aed;
          letter-spacing: 1.5px;
          margin-bottom: 6px;
          display: block;
        }

        .mc-modal-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--white-shade);
          margin-bottom: 8px;
          line-height: 1.2;
        }

        .mc-modal-price {
          font-size: 16px;
          font-weight: 700;
          color: #7c3aed;
          background: rgba(124, 58, 237, 0.05);
          border: 1px solid rgba(124, 58, 237, 0.15);
          padding: 4px 10px;
          border-radius: 6px;
          width: fit-content;
        }

        .mc-modal-desc {
          font-size: 13.5px;
          color: var(--muted);
          line-height: 1.6;
        }

        .mc-modal-divider {
          border: none;
          border-top: 1px solid var(--border);
          margin: 4px 0;
        }

        .mc-specs-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .mc-spec-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .mc-spec-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--dimmed);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .mc-spec-value {
          font-size: 13px;
          color: var(--white-shade);
        }

        .mc-sizes-row {
          display: flex;
          gap: 6px;
        }

        .mc-size-chip {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--white-shade);
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mc-features-list {
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mc-features-list li {
          font-size: 13px;
          color: var(--white-shade);
          list-style-type: disc;
        }

        .mc-modal-notice {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(124, 58, 237, 0.05);
          border: 1px solid rgba(124, 58, 237, 0.12);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          font-size: 12px;
          color: #7c3aed;
          margin-top: 8px;
        }

        .mc-notice-icon {
          flex-shrink: 0;
        }

        .mc-search-actions-group {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        @media (max-width: 768px) {
          .mc-search-actions-group {
            width: 100%;
            flex-direction: row;
          }
          .mc-search-wrap {
            flex-grow: 1;
          }
        }

        .mc-add-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: var(--radius-sm);
          border: none;
          background: #7c3aed;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .mc-add-btn:hover {
          background: #6d28d9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
        }

        .mc-add-btn:active {
          transform: translateY(0);
        }

        .mc-form-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          width: 100%;
          max-width: 600px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.2);
          animation: scaleUpCard 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .mc-form-header {
          padding: 20px 28px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mc-form-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--white-shade);
          margin: 0;
        }

        .mc-form-body {
          padding: 28px;
          max-height: 65vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mc-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .mc-form-group label {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
        }

        .mc-form-input {
          height: 38px;
          padding: 0 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--white-shade);
          font-size: 13.5px;
          outline: none;
          transition: all 0.2s ease;
        }

        .mc-form-input:focus {
          border-color: rgba(124, 58, 237, 0.4);
        }

        .mc-form-textarea {
          min-height: 80px;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--white-shade);
          font-size: 13.5px;
          outline: none;
          resize: vertical;
          transition: all 0.2s ease;
        }

        .mc-form-textarea:focus {
          border-color: rgba(124, 58, 237, 0.4);
        }

        .mc-form-select {
          height: 38px;
          padding: 0 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--white-shade);
          font-size: 13.5px;
          outline: none;
          cursor: pointer;
        }

        .mc-form-select option {
          background: var(--surface2);
          color: var(--white-shade);
        }

        .mc-form-footer {
          padding: 20px 28px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .mc-form-cancel-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mc-form-cancel-btn:hover {
          color: var(--white-shade);
          border-color: var(--muted);
        }

        .mc-form-submit-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: var(--radius-sm);
          border: none;
          background: #7c3aed;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mc-form-submit-btn:hover {
          background: #6d28d9;
        }

        .mc-card-actions {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 6px;
          z-index: 20;
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s ease;
          transform: translateY(-5px);
        }

        .mc-card:hover .mc-card-actions {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }

        .mc-card-action-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .mc-card-action-btn:hover {
          background: var(--surface2);
          color: #7c3aed;
          border-color: rgba(124, 58, 237, 0.3);
          transform: scale(1.1);
        }

        .mc-card-action-btn.delete-btn:hover {
          color: #dc2626;
          border-color: rgba(220, 38, 38, 0.3);
        }

        .mc-delete-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          width: 100%;
          max-width: 400px;
          padding: 32px 28px 24px;
          text-align: center;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.15);
          animation: scaleUpCard 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .mc-delete-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--white-shade);
          margin: 0 0 8px;
        }

        .mc-delete-desc {
          font-size: 13.5px;
          color: var(--muted);
          margin: 0 0 24px;
          line-height: 1.5;
        }

        .mc-delete-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(220, 38, 38, 0.08);
          border: 1px solid rgba(220, 38, 38, 0.2);
          color: #dc2626;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .mc-delete-actions {
          display: flex;
          gap: 10px;
        }

        .mc-delete-cancel-btn {
          flex: 1;
          height: 40px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mc-delete-cancel-btn:hover {
          color: var(--white-shade);
          border-color: var(--muted);
        }

        .mc-delete-confirm-btn {
          flex: 1;
          height: 40px;
          border-radius: var(--radius-sm);
          border: none;
          background: #dc2626;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mc-delete-confirm-btn:hover {
          background: #b91c1c;
          box-shadow: 0 0 15px rgba(220, 38, 38, 0.3);
        }
      `}</style>
    </div>
  );
}
