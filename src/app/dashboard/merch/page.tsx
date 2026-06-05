"use client";

import { useState } from "react";
import { 
  ShoppingBag, 
  Shirt, 
  Tag, 
  Sparkles, 
  X, 
  Search, 
  Layers, 
  Grid,
  Info
} from "lucide-react";

interface MerchItem {
  id: string;
  name: string;
  category: "apparel" | "accessories";
  pricePlaceholder: string;
  image: string;
  description: string;
  status: "Showcase Only" | "Coming Soon";
  details: {
    material: string;
    sizes?: string[];
    colors: string[];
    features: string[];
  };
}

const MERCH_ITEMS: MerchItem[] = [
  {
    id: "hoodie",
    name: "Pharmacy Premium Hoodie",
    category: "apparel",
    pricePlaceholder: "PHP 1,299.00",
    image: "/merch/hoodie.png",
    description: "Premium heavyweight cotton hoodie featuring forest green coloring with signature gold embroidered 'Pharmacy' lettering across the chest.",
    status: "Coming Soon",
    details: {
      material: "80% Organic Cotton / 20% Polyester Blend (380 GSM)",
      sizes: ["S", "M", "L", "XL", "XXL"],
      colors: ["Forest Green with Gold Embroidery"],
      features: [
        "Double-lined hood with adjustable drawstrings",
        "Ribbed cuffs and waistband",
        "Front kangaroo pocket",
        "Embroidered premium detailing"
      ]
    }
  },
  {
    id: "shirt",
    name: "Pharmacy Signature Shirt",
    category: "apparel",
    pricePlaceholder: "PHP 599.00",
    image: "/merch/shirt.png",
    description: "Minimalist off-white signature tee designed for everyday comfort, featuring a clean green 'Pharmacy' chest print.",
    status: "Showcase Only",
    details: {
      material: "100% Ring-Spun Combed Cotton (200 GSM)",
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      colors: ["Off-White / Cream with Green Printing"],
      features: [
        "Pre-shrunk fabric",
        "Side-seamed construction",
        "Double-needle topstitched collar",
        "Soft and breathable wear"
      ]
    }
  },
  {
    id: "tote",
    name: "Pharmacy Official Tote Bag",
    category: "accessories",
    pricePlaceholder: "PHP 350.00",
    image: "/merch/tote.png",
    description: "Durable white canvas tote bag with a stylish green leather-styled handle, featuring the centered 'Pharmacy' branding.",
    status: "Coming Soon",
    details: {
      material: "Heavy-Duty 12oz Cotton Canvas / Vegan Leather Straps",
      colors: ["Natural White Canvas with Forest Green Straps"],
      features: [
        "Spacious main compartment",
        "Zippered top closure for security",
        "Reinforced base and stitching",
        "Inner pocket for smartphones or keys"
      ]
    }
  },
  {
    id: "lanyard",
    name: "Pharmacy Event Lanyard",
    category: "accessories",
    pricePlaceholder: "PHP 120.00",
    image: "/merch/lanyard.png",
    description: "Official event lanyard with forest green strap and premium gold text printing, complete with a secure silver clasp.",
    status: "Showcase Only",
    details: {
      material: "High-Density Smooth Satin Polyester",
      colors: ["Forest Green with Gold Print"],
      features: [
        "Heavy-duty metal trigger hook",
        "Safety breakaway clasp at the neck",
        "Optimal 20mm width for comfort",
        "Dual-sided logo printing"
      ]
    }
  }
];

export default function MerchCataloguePage() {
  const [filter, setFilter] = useState<"all" | "apparel" | "accessories">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MerchItem | null>(null);

  const filteredItems = MERCH_ITEMS.filter((item) => {
    const matchesFilter = filter === "all" || item.category === filter;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fade-in sd-root" style={{ paddingBottom: "60px" }}>
      {/* Header */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Official Showcase</p>
          <h1 className="sd-header-title">Merch Catalogue</h1>
        </div>
      </header>

      {/* Info Banner */}
      <div className="mc-info-banner">
        <Info size={16} className="mc-info-icon" />
        <span className="mc-info-text">
          <strong>Showcase Only:</strong> Browse our exclusive College of Pharmacy merchandise. Items marked &quot;Coming Soon&quot; will be available for pre-order at the department office.
        </span>
      </div>

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

        {/* Search */}
        <div className="mc-search-wrap">
          <Search size={16} className="mc-search-icon" />
          <input
            type="text"
            className="mc-search-input"
            placeholder="Search merchandise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
              <div className="mc-modal-visual">
                <img 
                  src={selectedItem.image} 
                  alt={selectedItem.name} 
                  className="mc-modal-image"
                />
                <span className={`mc-modal-status ${selectedItem.status === "Coming Soon" ? "status-soon" : "status-showcase"}`}>
                  <Sparkles size={12} />
                  <span>{selectedItem.status}</span>
                </span>
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styled JSX */}
      <style jsx>{`
        .mc-info-banner {
          display: flex;
          gap: 12px;
          background: rgba(124, 58, 237, 0.05);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-radius: var(--radius);
          padding: 16px 20px;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .mc-info-icon {
          color: #7c3aed;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .mc-info-text {
          font-size: 13.5px;
          color: var(--white-shade);
        }

        .mc-info-text strong {
          color: #7c3aed;
          font-weight: 700;
          margin-right: 4px;
        }

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

        .mc-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--dimmed);
          pointer-events: none;
        }

        .mc-search-input {
          width: 100%;
          height: 38px;
          padding: 0 12px 0 38px;
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
      `}</style>
    </div>
  );
}
