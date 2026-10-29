import { Link } from 'react-router-dom';
import artwork from '../references/Key Features section.png';
import './LandingKeyFeatures.css';

const features = [
  { icon: 'cube', title: 'Product Management', lines: ['Organize products with SKUs,', 'barcodes, categories, and detailed', 'information.'] },
  { icon: 'warehouse', title: 'Warehouse & Location Management', lines: ['Manage multiple warehouses and', 'storage locations with flexible', 'location coding.'] },
  { icon: 'layers', title: 'Inventory Tracking', lines: ['Get real-time visibility of stock', 'levels across all warehouses', 'and locations.'] },
  { icon: 'arrows', title: 'Stock Movements', lines: ['Handle receiving, adjustments,', 'transfers, and complete transaction', 'history.'] },
  { icon: 'order', title: 'Orders & Dispatch', lines: ['Create orders, allocate stock,', 'and manage dispatch with', 'location-based picking.'] },
  { icon: 'users', title: 'User Management & Access', lines: ['Control access with roles, invite', 'team members, and track all', 'activities with audit logs.'] },
];

function FeatureIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
      {name === 'cube' && <><path d="m20 4 14 8v16l-14 8-14-8V12L20 4Z" /><path d="m6 12 14 8 14-8M20 20v16M13 8l14 8v8" /></>}
      {name === 'warehouse' && <><path d="m5 14 15-10 15 10v20H5V14Z" /><path d="M13 34V22h14v12m-14-6h14m-7-6v12" /></>}
      {name === 'layers' && <><path d="m20 4 14 8-14 8-14-8 14-8Zm-14 16 14 8 14-8M6 28l14 8 14-8" /></>}
      {name === 'arrows' && <><path d="M5 12h28m-7-7 7 7-7 7M35 28H7m7-7-7 7 7 7" /></>}
      {name === 'order' && <><path d="M9 3h15l9 9v24H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" /><path d="M23 3v10h10M12 15h4m-4 7h14m-14 7h10" /></>}
      {name === 'users' && <><circle cx="20" cy="12" r="6" /><path d="M10 33v-4c0-8 20-8 20 0v4H10ZM7 8a5 5 0 0 0 0 10M33 8a5 5 0 0 1 0 10M4 30v-5c0-3 3-5 6-5m26 10v-5c0-3-3-5-6-5" /></>}
    </svg>
  );
}

export function LandingKeyFeatures() {

  return (
    <section id="key-features" className="landing-features" aria-labelledby="key-features-title">
      <figure className="landing-features-artwork">
        <img src={artwork} alt="Warehouse aisle with illustrative product totals, locations, and recent stock movement panels." loading="lazy" decoding="async" />
      </figure>
      <div className="landing-features-copy">
        <p className="landing-features-eyebrow">Key Features</p>
        <h2 id="key-features-title">Everything You Need<span>in One WMS</span></h2>
        <p className="landing-features-description">A complete set of features to manage your inventory, streamline operations, and keep your warehouse running smoothly.</p>
        <div className="landing-features-grid">
          {features.map(({ icon, title, lines }) => (
            <article key={title} className="landing-feature">
              <div className="landing-feature-icon" aria-hidden="true"><FeatureIcon name={icon} /></div>
              <div><h3>{title}</h3><p>{lines.map((line, index) => <span key={line}>{index > 0 && ' '}{line}</span>)}</p></div>
            </article>
          ))}
        </div>
        <div className="landing-features-actions">
          <Link className="landing-features-explore" to="/auth/sign-in">Explore All Features<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h17m-7-7 7 7-7 7" /></svg></Link>
        </div>
      </div>
    </section>
  );
}
