import { Link } from 'react-router-dom';
import benefitsArtwork from '../references/Business Benefits section.png';
import './LandingBusinessBenefits.css';

const benefits = [
  { icon: 'clock', title: ['Higher Operational', 'Efficiency'], lines: ['Streamline receiving, picking,', 'packing, and dispatch with', 'structured workflows.'] },
  { icon: 'target', title: ['Improved Inventory', 'Accuracy'], lines: ['Get real-time, location-based', 'visibility and reduce stock', 'discrepancies.'] },
  { icon: 'coins', title: ['Lower Operational', 'Costs'], lines: ['Make better use of space,', 'staff, and equipment with', 'smarter planning.'] },
  { icon: 'chart', title: ['Faster Order Fulfillment'], lines: ['Pick, pack, and dispatch', 'orders quickly with accurate', 'stock information.'] },
  { icon: 'shield', title: ['Better Decision Making'], lines: ['Use real-time data and', 'reports to identify trends', 'and plan ahead.'] },
  { icon: 'expand', title: ['Built to Scale'], lines: ['Adapt to new warehouses,', 'growing product lines, and', 'increasing order volumes.'] },
];

function BenefitIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
      {name === 'clock' && <><circle cx="20" cy="21" r="14" /><path d="M20 12v10l6 3M20 5v4" /></>}
      {name === 'target' && <><circle cx="20" cy="20" r="13" /><circle cx="20" cy="20" r="5" /><path d="M20 3v8m0 18v8M3 20h8m18 0h8" /></>}
      {name === 'coins' && <><ellipse cx="20" cy="10" rx="11" ry="5" fill="currentColor" stroke="none" /><path d="M9 16c0 6 22 6 22 0M9 22c0 6 22 6 22 0M9 28c0 6 22 6 22 0" /></>}
      {name === 'chart' && <><path d="M5 24h5v12H5Zm12-9h5v21h-5Zm12-11h5v32h-5Z" fill="currentColor" stroke="none" /><path d="M7.5 27v6m12-14v13" stroke="#9fc7ff" strokeWidth="1.4" /></>}
      {name === 'shield' && <><path d="M20 4c6 3 10 4 14 4v12c0 7-6 13-14 17C12 33 6 27 6 20V8c4 0 8-1 14-4Z" /><path d="m14 20 4 4 9-9" /></>}
      {name === 'expand' && <><path d="M23 5h12v12M35 5 23 17M17 35H5V23m0 12 12-12" /></>}
    </svg>
  );
}

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h17m-7-7 7 7-7 7" /></svg>;
}

export function LandingBusinessBenefits() {

  return (
    <section id="business-benefits" className="landing-benefits" aria-labelledby="business-benefits-title">
      <figure className="landing-benefits-artwork">
        <img src={benefitsArtwork} alt="Warehouse with illustrative fulfillment, accuracy, and cost badges. The percentages belong to the design concept and are not measured customer results." loading="lazy" decoding="async" />
      </figure>
      <div className="landing-benefits-copy">
        <p className="landing-benefits-eyebrow">Business Benefits</p>
        <h2 id="business-benefits-title">Turn Warehouse Operations<span>into Real Business Value</span></h2>
        <p className="landing-benefits-description">Our WMS helps you reduce manual work, improve accuracy, and make faster, data-driven decisions so your business can operate more efficiently and scale with confidence.</p>
        <div className="landing-benefits-grid">
          {benefits.map(({ icon, title, lines }) => (
            <article key={icon} className="landing-benefit">
              <div className="landing-benefit-icon" aria-hidden="true"><BenefitIcon name={icon} /></div>
              <h3>{title.map((line, index) => <span key={line}>{index > 0 && ' '}{line}</span>)}</h3>
              <p>{lines.map((line, index) => <span key={line}>{index > 0 && ' '}{line}</span>)}</p>
            </article>
          ))}
        </div>
        <div className="landing-benefits-actions">
          <Link className="landing-benefits-primary" to="/auth/sign-in">See the Business Impact<Arrow /></Link>
        </div>
      </div>
    </section>
  );
}
